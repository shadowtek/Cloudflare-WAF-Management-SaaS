import { createClient } from 'npm:@supabase/supabase-js@2.39.7';
import { corsHeaders } from '../_shared/cors.ts';

interface CloudflareResponse {
  success: boolean;
  errors: { message: string }[];
  result: any[];
  result_info?: {
    page: number;
    per_page: number;
    total_count: number;
    count: number;
  };
}

interface DNSRecord {
  id: string;
  type: string;
  name: string;
  content: string;
  proxied: boolean;
}

interface WAFRule {
  id?: string;
  description: string;
  expression: string;
  action: string;
  action_parameters?: {
    ruleset?: string;
    phases?: string[];
    products?: string[];
  };
}

interface SecuritySettings {
  ssl_mode?: string;
  min_tls_version?: string;
}

let WAF_RULES: WAFRule[] = [];
let rulesLastFetched: number | null = null;
const RULES_CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries = 3,
  delay = 1000,
  backoff = 2
): Promise<Response> {
  try {
    const response = await fetch(url, options);
    
    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get('Retry-After') || '5', 10);
      const retryDelay = Math.max(retryAfter * 1000, delay);
      
      if (retries > 0) {
        console.log(`Rate limited, retrying after ${retryDelay}ms`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        return fetchWithRetry(url, options, retries - 1, retryDelay * backoff, backoff);
      }
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(JSON.stringify({
        status: response.status,
        statusText: response.statusText,
        url,
        errorData,
        headers: Object.fromEntries(response.headers.entries())
      }));
    }
    
    return response;
  } catch (error) {
    if (retries > 0) {
      console.log(`Request failed, retrying in ${delay}ms. Error:`, error);
      await new Promise(resolve => setTimeout(resolve, delay));
      return fetchWithRetry(url, options, retries - 1, delay * backoff, backoff);
    }
    throw error;
  }
}

async function getSecuritySettings(zoneId: string, headers: HeadersInit): Promise<SecuritySettings> {
  try {
    const url = `https://api.cloudflare.com/client/v4/zones/${zoneId}/settings/ssl`;
    const tlsUrl = `https://api.cloudflare.com/client/v4/zones/${zoneId}/settings/min_tls_version`;
    
    const [sslResponse, tlsResponse] = await Promise.all([
      fetchWithRetry(url, { headers }),
      fetchWithRetry(tlsUrl, { headers })
    ]);

    const [sslData, tlsData] = await Promise.all([
      sslResponse.json(),
      tlsResponse.json()
    ]);

    return {
      ssl_mode: sslData.success ? sslData.result.value : undefined,
      min_tls_version: tlsData.success ? tlsData.result.value : undefined
    };
  } catch (error) {
    console.error('Error fetching security settings:', error);
    return {};
  }
}

async function getDNSRecords(zoneId: string, zoneName: string, headers: HeadersInit): Promise<DNSRecord[]> {
  try {
    // Fetch both A and CNAME records
    const url = `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records?type=A,CNAME`;
    const response = await fetchWithRetry(url, { headers });
    const data: CloudflareResponse = await response.json();

    if (!data.success) {
      throw new Error(data.errors?.[0]?.message || 'Failed to fetch DNS records');
    }

    return data.result.map(record => ({
      id: record.id,
      type: record.type,
      name: record.name,
      content: record.content,
      proxied: record.proxied
    }));
  } catch (error) {
    console.error('Error fetching DNS records:', error);
    return [];
  }
}

async function fetchWAFRules(): Promise<WAFRule[]> {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data, error } = await supabase
      .from('waf_templates')
      .select('*')
      .eq('is_core', true)
      .order('display_order', { ascending: true });

    if (error) throw error;

    return data.map(template => ({
      description: template.name,
      expression: template.expression,
      action: template.action,
      action_parameters: template.action_parameters
    }));
  } catch (error) {
    console.error('Error fetching WAF rules:', error);
    throw error;
  }
}

async function getWAFRules(): Promise<WAFRule[]> {
  const now = Date.now();
  if (!rulesLastFetched || now - rulesLastFetched > RULES_CACHE_TTL || WAF_RULES.length === 0) {
    WAF_RULES = await fetchWAFRules();
    rulesLastFetched = now;
  }
  return WAF_RULES;
}

async function checkZoneRules(zoneId: string, headers: HeadersInit): Promise<'In Sync' | 'Out of Sync' | 'Error'> {
  try {
    const url = `https://api.cloudflare.com/client/v4/zones/${zoneId}/rulesets/phases/http_request_firewall_custom/entrypoint`;
    const response = await fetchWithRetry(url, { headers });
    const data = await response.json();

    if (!data.success) {
      throw new Error(data.errors?.[0]?.message || 'Failed to fetch zone rules');
    }

    const expectedRules = await getWAFRules();
    const currentRules = data.result?.rules || [];

    // Check if all expected rules exist with correct configuration
    for (const expected of expectedRules) {
      const found = currentRules.find((rule: any) => 
        rule.description === expected.description &&
        rule.expression === expected.expression &&
        rule.action === expected.action
      );

      if (!found) {
        return 'Out of Sync';
      }
    }

    // Check if there are any extra rules that shouldn't be there
    if (currentRules.length > expectedRules.length) {
      return 'Out of Sync';
    }

    return 'In Sync';
  } catch (error) {
    console.error('Error checking zone rules:', error);
    return 'Error';
  }
}

async function disableWAFRules(zoneId: string, headers: HeadersInit): Promise<boolean> {
  try {
    const url = `https://api.cloudflare.com/client/v4/zones/${zoneId}/rulesets/phases/http_request_firewall_custom/entrypoint`;
    const response = await fetchWithRetry(url, {
      method: 'PUT',
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        rules: []
      })
    });

    const data = await response.json();
    return data.success;
  } catch (error) {
    console.error('Error disabling WAF rules:', error);
    throw error;
  }
}

async function createOrUpdateRuleset(zoneId: string, headers: HeadersInit): Promise<string | null> {
  try {
    // First, try to get the existing ruleset
    const getUrl = `https://api.cloudflare.com/client/v4/zones/${zoneId}/rulesets/phases/http_request_firewall_custom/entrypoint`;
    const getResponse = await fetchWithRetry(getUrl, { headers });
    const getData = await getResponse.json();

    if (getData.success && getData.result?.id) {
      return getData.result.id;
    }

    // If no ruleset exists, create one
    const createUrl = `https://api.cloudflare.com/client/v4/zones/${zoneId}/rulesets`;
    const createResponse = await fetchWithRetry(createUrl, {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'WAFManager Pro Rules',
        kind: 'zone',
        phase: 'http_request_firewall_custom',
        description: 'Custom WAF rules managed by WAFManager Pro'
      })
    });

    const createData = await createResponse.json();
    return createData.success ? createData.result.id : null;
  } catch (error) {
    console.error('Error creating/updating ruleset:', error);
    return null;
  }
}

async function applyRulesToZone(zoneId: string, headers: HeadersInit): Promise<boolean> {
  try {
    const rules = await getWAFRules();
    console.log(`Fetched ${rules.length} rules to apply to zone ${zoneId}`);

    // Get the phase entrypoint URL
    const phaseUrl = `https://api.cloudflare.com/client/v4/zones/${zoneId}/rulesets/phases/http_request_firewall_custom/entrypoint`;
    
    // First, try to update existing ruleset
    const updateResponse = await fetchWithRetry(phaseUrl, {
      method: 'PUT',
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        rules: rules.map((rule, index) => ({
          ...rule,
          enabled: true,
          expression: rule.expression,
          action: rule.action,
          description: rule.description,
          position: index + 1
        }))
      })
    });

    const updateData = await updateResponse.json();
    
    if (!updateData.success) {
      // If update fails, try to create a new ruleset
      const createResponse = await fetchWithRetry(
        `https://api.cloudflare.com/client/v4/zones/${zoneId}/rulesets`,
        {
          method: 'POST',
          headers: {
            ...headers,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name: 'WAFManager Pro Rules',
            kind: 'zone',
            phase: 'http_request_firewall_custom',
            description: 'Custom WAF rules managed by WAFManager Pro',
            rules: rules.map((rule, index) => ({
              ...rule,
              enabled: true,
              expression: rule.expression,
              action: rule.action,
              description: rule.description,
              position: index + 1
            }))
          })
        }
      );

      const createData = await createResponse.json();
      if (!createData.success) {
        throw new Error('Failed to create and apply rules');
      }
      return true;
    }

    return true;
  } catch (error) {
    console.error('Error applying rules to zone:', error);
    throw error;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      apiKey, 
      email, 
      accountId, 
      page = 1, 
      perPage = 50, 
      search = '', 
      action,
      zoneId,
      zoneIds,
      recordId,
      record,
      proxied
    } = await req.json();

    if (!apiKey || !email || !accountId) {
      throw new Error('Missing required Cloudflare credentials');
    }

    const headers = {
      'X-Auth-Email': email,
      'X-Auth-Key': apiKey,
      'Content-Type': 'application/json',
    };

    if (action === 'update_dns_proxy' && zoneId && recordId && record) {
      const url = `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records/${recordId}`;
      const response = await fetchWithRetry(
        url,
        {
          method: 'PUT',
          headers,
          body: JSON.stringify({
            ...record,
            proxied
          }),
        }
      );

      const data = await response.json();
      return new Response(
        JSON.stringify(data),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if ((action === 'apply_rules' || action === 'resync_rules') && (zoneId || zoneIds)) {
      const zonesToUpdate = zoneId ? [zoneId] : zoneIds;
      const results = [];
      
      // Clear the rules cache to force a fresh fetch
      rulesLastFetched = null;
      WAF_RULES = [];
      
      for (const id of zonesToUpdate) {
        try {
          console.log(`Processing zone ${id}`);
          const success = await applyRulesToZone(id, headers);
          results.push({ zoneId: id, success });
        } catch (error) {
          console.error(`Error applying rules to zone ${id}:`, error);
          results.push({ 
            zoneId: id, 
            success: false, 
            error: error instanceof Error ? error.message : 'Unknown error' 
          });
        }
      }
      
      return new Response(
        JSON.stringify({ success: true, results }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'disable_waf' && zoneId) {
      try {
        const success = await disableWAFRules(zoneId, headers);
        return new Response(
          JSON.stringify({ success }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (error) {
        console.error('Error disabling WAF rules:', error);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: error instanceof Error ? error.message : 'Failed to disable WAF rules' 
          }),
          { 
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }

    const encodedAccountId = encodeURIComponent(accountId);
    const encodedSearch = encodeURIComponent(search);
    const apiUrl = `https://api.cloudflare.com/client/v4/zones?account.id=${encodedAccountId}&page=${page}&per_page=${perPage}${search ? `&name=${encodedSearch}` : ''}`;

    const response = await fetchWithRetry(apiUrl, { headers });
    const data: CloudflareResponse = await response.json();

    if (!data.success) {
      throw new Error(data.errors?.[0]?.message || 'Failed to fetch zones');
    }

    const zonesWithStatus = await Promise.all(
      data.result.map(async (zone) => {
        const [wafStatus, dnsRecords, securitySettings] = await Promise.all([
          checkZoneRules(zone.id, headers),
          getDNSRecords(zone.id, zone.name, headers),
          getSecuritySettings(zone.id, headers)
        ]);

        return {
          ...zone,
          wafStatus,
          dnsRecords,
          securitySettings
        };
      })
    );

    data.result = zonesWithStatus;

    return new Response(
      JSON.stringify(data),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error processing request:', error);
    
    const errorResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'An error occurred',
      details: error instanceof Error ? {
        name: error.name,
        stack: error.stack,
        cause: error.cause
      } : undefined
    };

    return new Response(
      JSON.stringify(errorResponse),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});