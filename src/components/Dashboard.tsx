import React, { useState, useEffect } from 'react';
import { Shield, RefreshCw, Search, ChevronLeft, ChevronRight, CheckCircle, XCircle, Loader2, Settings as SettingsIcon, ChevronDown, ChevronUp, Plus, Trash2, AlertTriangle, Cloud, CloudOff, ShieldOff, Server } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

interface CloudflareCredentials {
  id: string;
  name: string;
  apiKey: string;
  email: string;
  accountId: string;
}

interface DNSRecord {
  id: string;
  type: string;
  name: string;
  content: string;
  proxied: boolean;
}

interface Zone {
  id: string;
  name: string;
  wafStatus: 'inactive' | 'active' | 'out-of-sync';
  dnsRecords?: {
    www: DNSRecord | null;
    apex: DNSRecord | null;
  };
}

interface PaginationInfo {
  page: number;
  perPage: number;
  totalCount: number;
  count: number;
}

const perPageOptions = [10, 25, 50, 100];

const WAFRuleDescriptions = [
  {
    name: "Good Bots Allow",
    description: "Allows legitimate bot traffic from verified sources including search engines, monitoring tools, and security services. This rule ensures that beneficial automated traffic can access your site while maintaining security.",
    details: "Permits access for verified bots in categories like search engines, analytics, and security tools. Also allows specific user agents for services like Let's Encrypt and webhook systems."
  },
  {
    name: "MC Providers and Countries",
    description: "Implements geographic and cloud provider-based access controls with managed challenges. This helps protect against automated threats while maintaining accessibility for legitimate users.",
    details: "Applies managed challenges to traffic from major cloud providers and non-Australian IP addresses, helping to prevent automated attacks while allowing legitimate users to proceed after verification."
  },
  {
    name: "MC Aggressive Crawlers",
    description: "Manages access from aggressive or potentially problematic crawlers and bots through challenge-based verification.",
    details: "Targets known aggressive crawlers and unverified bot traffic with managed challenges, protecting resources while allowing legitimate access after verification."
  },
  {
    name: "MC VPNs and WP Login",
    description: "Protects WordPress login pages and manages VPN-based access attempts through challenge verification.",
    details: "Applies managed challenges to traffic from known VPN providers and WordPress login attempts to prevent unauthorized access and brute force attacks."
  },
  {
    name: "Block Web Hosts / WP Paths / TOR",
    description: "Blocks high-risk traffic sources and protects sensitive WordPress paths from unauthorized access.",
    details: "Prevents access from known high-risk hosting providers, blocks access to sensitive WordPress files, and restricts TOR network traffic to maintain security."
  }
];

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const fetchWithRetry = async <T,>(
  fn: () => Promise<T>,
  retries = 3,
  delay = 1000,
  backoff = 2
): Promise<T> => {
  try {
    return await fn();
  } catch (error: any) {
    if (
      retries > 0 &&
      error.message?.includes('Please wait and consider throttling your request speed')
    ) {
      await sleep(delay);
      return fetchWithRetry(fn, retries - 1, delay * backoff, backoff);
    }
    throw error;
  }
};

export default function Dashboard() {
  const { user } = useAuth();
  const [credentials, setCredentials] = useState<CloudflareCredentials[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<CloudflareCredentials | null>(null);
  const [zones, setZones] = useState<Zone[]>([]);
  const [selectedZones, setSelectedZones] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [processingZones, setProcessingZones] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    perPage: 10,
    totalCount: 0,
    count: 0,
  });
  const [expandedRules, setExpandedRules] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'account' | 'rules' | 'zones'>('account');

  const getStatusColor = (status: Zone['wafStatus']) => {
    switch (status) {
      case 'active':
        return 'text-green-600';
      case 'out-of-sync':
        return 'text-yellow-600';
      case 'inactive':
        return 'text-red-600';
    }
  };

  const getStatusIcon = (status: Zone['wafStatus']) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="h-5 w-5 mr-1" />;
      case 'out-of-sync':
        return <AlertTriangle className="h-5 w-5 mr-1" />;
      case 'inactive':
        return <XCircle className="h-5 w-5 mr-1" />;
    }
  };

  const getStatusText = (status: Zone['wafStatus']) => {
    switch (status) {
      case 'active':
        return 'In Sync';
      case 'out-of-sync':
        return 'Out of Sync';
      case 'inactive':
        return 'Inactive';
    }
  };

  useEffect(() => {
    if (user) {
      loadCredentials();
    }
  }, [user]);

  const loadCredentials = async () => {
    try {
      const { data, error } = await supabase
        .from('credentials')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: true });

      if (error) throw error;

      if (data && data.length > 0) {
        const formattedCreds = data.map(cred => ({
          id: cred.id,
          name: cred.name || 'Default Account',
          apiKey: cred.api_key,
          email: cred.email,
          accountId: cred.account_id,
        }));
        setCredentials(formattedCreds);
        
        if (!selectedAccount) {
          setSelectedAccount(formattedCreds[0]);
        }
      }
    } catch (error) {
      console.error('Error loading credentials:', error);
      toast.error('Failed to load accounts');
    }
  };

  const saveCredentials = async () => {
    if (!user || !selectedAccount) return;

    setIsSaving(true);
    try {
      const credentialsData = {
        user_id: user.id,
        name: selectedAccount.name,
        api_key: selectedAccount.apiKey,
        email: selectedAccount.email,
        account_id: selectedAccount.accountId,
      };

      let error;
      if (selectedAccount.id) {
        const { error: updateError } = await supabase
          .from('credentials')
          .update(credentialsData)
          .eq('id', selectedAccount.id);
        error = updateError;
      } else {
        const { error: insertError } = await supabase
          .from('credentials')
          .insert([credentialsData]);
        error = insertError;
      }

      if (error) throw error;
      toast.success('Account saved successfully!');
      await loadCredentials();
    } catch (error) {
      console.error('Error saving credentials:', error);
      toast.error('Failed to save account');
    } finally {
      setIsSaving(false);
    }
  };

  const deleteAccount = async (id: string) => {
    try {
      const { error } = await supabase
        .from('credentials')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Account deleted successfully');
      await loadCredentials();
      
      if (selectedAccount?.id === id) {
        const remainingCreds = credentials.filter(cred => cred.id !== id);
        setSelectedAccount(remainingCreds.length > 0 ? remainingCreds[0] : null);
      }
    } catch (error) {
      console.error('Error deleting account:', error);
      toast.error('Failed to delete account');
    }
  };

  const fetchZones = async (
    page = pagination.page,
    perPage = pagination.perPage,
    searchTerm = search
  ) => {
    setLoading(true);
    try {
      if (!selectedAccount?.apiKey || !selectedAccount?.email || !selectedAccount?.accountId) {
        throw new Error('Please provide all required credentials');
      }

      await fetchWithRetry(async () => {
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cloudflare-proxy`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              apiKey: selectedAccount.apiKey,
              email: selectedAccount.email,
              accountId: selectedAccount.accountId,
              page,
              perPage,
              search: searchTerm,
            }),
          }
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(
            errorData.error || `Request failed with status ${response.status}`
          );
        }

        const data = await response.json();
        
        if (!data.success) {
          throw new Error(data.errors?.[0]?.message || 'Failed to fetch zones');
        }

        const newZones = data.result.map((zone: any) => ({
          id: zone.id,
          name: zone.name,
          wafStatus: zone.wafStatus || 'inactive',
          dnsRecords: zone.dnsRecords,
        }));

        setZones(newZones);
        setSelectedZones([]);

        if (data.result_info) {
          setPagination({
            page: data.result_info.page,
            perPage: data.result_info.per_page,
            totalCount: data.result_info.total_count,
            count: data.result_info.count,
          });
        }

        toast.success('Zones fetched successfully!');
      });
    } catch (error) {
      console.error('Error fetching zones:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to fetch zones');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearch(value);
    fetchZones(1, pagination.perPage, value);
  };

  const handlePerPageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = parseInt(e.target.value, 10);
    setPagination(prev => ({ ...prev, perPage: value }));
    fetchZones(1, value, search);
  };

  const handlePageChange = (newPage: number) => {
    setPagination(prev => ({ ...prev, page: newPage }));
    fetchZones(newPage, pagination.perPage, search);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const newSelectedZones = zones
        .filter(zone => zone.wafStatus !== 'active')
        .map(zone => zone.id);
      setSelectedZones(newSelectedZones);
    } else {
      setSelectedZones([]);
    }
  };

  const handleZoneSelection = (zoneId: string) => {
    setSelectedZones((prev) =>
      prev.includes(zoneId)
        ? prev.filter((id) => id !== zoneId)
        : [...prev, zoneId]
    );
  };

  const handleApplyRules = async (zoneIds: string[]) => {
    if (!selectedAccount) return;
    
    setProcessingZones(prev => [...prev, ...zoneIds]);
    try {
      await fetchWithRetry(async () => {
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cloudflare-proxy`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              apiKey: selectedAccount.apiKey,
              email: selectedAccount.email,
              accountId: selectedAccount.accountId,
              action: 'apply_rules',
              zoneIds,
            }),
          }
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `Request failed with status ${response.status}`);
        }

        const data = await response.json();
        
        if (!data.success) {
          throw new Error('Failed to apply WAF rules');
        }

        setZones(prevZones => 
          prevZones.map(zone => 
            zoneIds.includes(zone.id) 
              ? { ...zone, wafStatus: 'active' }
              : zone
          )
        );

        toast.success('WAF rules applied successfully!');
        setSelectedZones(prev => prev.filter(id => !zoneIds.includes(id)));
      });
    } catch (error) {
      console.error('Failed to apply rules:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to apply WAF rules');
      
      await fetchZones(pagination.page, pagination.perPage, search);
    } finally {
      setProcessingZones(prev => prev.filter(id => !zoneIds.includes(id)));
    }
  };

  const handleResyncRules = async (zoneId: string) => {
    if (!selectedAccount) return;
    
    setProcessingZones(prev => [...prev, zoneId]);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cloudflare-proxy`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            apiKey: selectedAccount.apiKey,
            email: selectedAccount.email,
            accountId: selectedAccount.accountId,
            action: 'resync_rules',
            zoneIds: [zoneId],
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Request failed with status ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error('Failed to resync WAF rules');
      }

      setZones(prevZones => 
        prevZones.map(zone => 
          zone.id === zoneId 
            ? { ...zone, wafStatus: 'active' }
            : zone
        )
      );

      toast.success('WAF rules resynced successfully!');
    } catch (error) {
      console.error('Failed to resync rules:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to resync WAF rules');
      
      await fetchZones(pagination.page, pagination.perPage, search);
    } finally {
      setProcessingZones(prev => prev.filter(id => id !== zoneId));
    }
  };

  const handleToggleProxy = async (zoneId: string, recordId: string, record: DNSRecord, newProxiedState: boolean) => {
    if (!selectedAccount) return;
    
    setProcessingZones(prev => [...prev, zoneId]);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cloudflare-proxy`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            apiKey: selectedAccount.apiKey,
            email: selectedAccount.email,
            accountId: selectedAccount.accountId,
            action: 'update_dns_proxy',
            zoneId,
            recordId,
            record,
            proxied: newProxiedState,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to update DNS proxy status');
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error('Failed to update DNS proxy status');
      }

      setZones(prevZones =>
        prevZones.map(zone => {
          if (zone.id === zoneId && zone.dnsRecords) {
            const updatedRecords = { ...zone.dnsRecords };
            if (record.name.startsWith('www.')) {
              updatedRecords.www = { ...record, proxied: newProxiedState };
            } else {
              updatedRecords.apex = { ...record, proxied: newProxiedState };
            }
            return { ...zone, dnsRecords: updatedRecords };
          }
          return zone;
        })
      );

      toast.success(`Successfully ${newProxiedState ? 'enabled' : 'disabled'} proxy for ${record.name}`);
    } catch (error) {
      console.error('Error updating DNS proxy:', error);
      toast.error('Failed to update DNS proxy status');
    } finally {
      setProcessingZones(prev => prev.filter(id => id !== zoneId));
    }
  };

  const handleDisableWAF = async (zoneId: string) => {
    if (!selectedAccount) return;
    
    setProcessingZones(prev => [...prev, zoneId]);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cloudflare-proxy`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            apiKey: selectedAccount.apiKey,
            email: selectedAccount.email,
            accountId: selectedAccount.accountId,
            action: 'disable_waf',
            zoneId,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Request failed with status ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error('Failed to disable WAF rules');
      }

      setZones(prevZones => 
        prevZones.map(zone => 
          zone.id === zoneId 
            ? { ...zone, wafStatus: 'inactive' }
            : zone
        )
      );

      toast.success('WAF rules disabled successfully!');
    } catch (error) {
      console.error('Failed to disable WAF:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to disable WAF rules');
      
      await fetchZones(pagination.page, pagination.perPage, search);
    } finally {
      setProcessingZones(prev => prev.filter(id => id !== zoneId));
    }
  };

  const toggleRuleExpansion = (ruleName: string) => {
    setExpandedRules(prev => 
      prev.includes(ruleName)
        ? prev.filter(name => name !== ruleName)
        : [...prev, ruleName]
    );
  };

  const renderDNSInfo = (zone: Zone) => {
    if (!zone.dnsRecords?.apex) return null;

    return (
      <div className="flex items-center space-x-2">
        <div className="flex items-center text-gray-600">
          <Server className="h-4 w-4 mr-1" />
          <span className="text-sm font-mono">{zone.dnsRecords.apex.content}</span>
        </div>
        <div className="flex items-center space-x-2">
          {zone.dnsRecords.apex && (
            <button
              onClick={() => handleToggleProxy(
                zone.id,
                zone.dnsRecords.apex.id,
                zone.dnsRecords.apex,
                !zone.dnsRecords.apex.proxied
              )}
              disabled={processingZones.includes(zone.id)}
              className={`inline-flex items-center px-2 py-1 border text-xs font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                zone.dnsRecords.apex.proxied
                  ? 'border-orange-300 text-orange-700 bg-orange-50 hover:bg-orange-100 focus:ring-orange-500'
                  : 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50 focus:ring-gray-500'
              }`}
              title="Root Domain Proxy Status"
            >
              {zone.dnsRecords.apex.proxied ? (
                <Cloud className="h-4 w-4" />
              ) : (
                <CloudOff className="h-4 w-4" />
              )}
            </button>
          )}
          {zone.dnsRecords.www && (
            <button
              onClick={() => handleToggleProxy(
                zone.id,
                zone.dnsRecords.www.id,
                zone.dnsRecords.www,
                !zone.dnsRecords.www.proxied
              )}
              disabled={processingZones.includes(zone.id)}
              className={`inline-flex items-center px-2 py-1 border text-xs font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                zone.dnsRecords.www.proxied
                  ? 'border-orange-300 text-orange-700 bg-orange-50 hover:bg-orange-100 focus:ring-orange-500'
                  : 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50 focus:ring-gray-500'
              }`}
              title="WWW Proxy Status"
            >
              WWW{' '}
              {zone.dnsRecords.www.proxied ? (
                <Cloud className="h-4 w-4 ml-1" />
              ) : (
                <CloudOff className="h-4 w-4 ml-1" />
              )}
            </button>
          )}
        </div>
      </div>
    );
  };

  const totalPages = Math.ceil(pagination.totalCount / pagination.perPage);
  const selectableZonesCount = zones.filter(zone => zone.wafStatus !== 'active').length;
  const allSelectableZonesSelected = selectableZonesCount > 0 && selectedZones.length === selectableZonesCount;

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
      {/* Mobile Navigation */}
      <div className="md:hidden mb-6">
        <nav className="flex space-x-2 bg-gray-100 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab('account')}
            className={`flex-1 px-4 py-2 text-sm font-medium rounded-md ${
              activeTab === 'account'
                ? 'bg-white text-orange-600 shadow'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Account
          </button>
          <button
            onClick={() => setActiveTab('rules')}
            className={`flex-1 px-4 py-2 text-sm font-medium rounded-md ${
              activeTab === 'rules'
                ? 'bg-white text-orange-600 shadow'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Rules
          </button>
          <button
            onClick={() => setActiveTab('zones')}
            className={`flex-1 px-4 py-2 text-sm font-medium rounded-md ${
              activeTab === 'zones'
                ? 'bg-white text-orange-600 shadow'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Zones
          </button>
        </nav>
      </div>

      {/* Desktop Layout */}
      <div className="space-y-6">
        {/* Top Section with Account Manager and WAF Rules */}
        <div className="flex flex-col md:flex-row md:gap-6">
          {/* Account Management Section */}
          <div 
            className={`${
              activeTab === 'account' ? 'block' : 'hidden'
            } md:block md:w-1/2 bg-white shadow rounded-lg p-6 mb-6 md:mb-0`}
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center">
                <Shield className="h-6 w-6 text-orange-600" />
                <h2 className="ml-2 text-xl md:text-2xl font-bold text-gray-900">
                  Cloudflare Account Manager
                </h2>
              </div>
              {user?.email === 'steve@shadowtek.com.au' && (
                <a
                  href="/templates"
                  className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-gray-700 hover:text-gray-900 focus:outline-none"
                >
                  <SettingsIcon className="h-5 w-5 mr-2" />
                  <span className="hidden sm:inline">WAF Templates</span>
                </a>
              )}
            </div>

            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:space-x-4 space-y-4 sm:space-y-0">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Account
                  </label>
                  <select
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    value={selectedAccount?.id || ''}
                    onChange={(e) => {
                      const selected = credentials.find(c => c.id === e.target.value);
                      setSelectedAccount(selected || null);
                    }}
                  >
                    {credentials.map(cred => (
                      <option key={cred.id} value={cred.id}>
                        {cred.name} ({cred.accountId})
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={() => {
                    setSelectedAccount({
                      id: '',
                      name: 'New Account',
                      apiKey: '',
                      email: user?.email || '',
                      accountId: '',
                    });
                  }}
                  className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <Plus className="h-5 w-5 mr-2" />
                  Add Account
                </button>
              </div>

              {selectedAccount && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Account Name
                    </label>
                    <input
                      type="text"
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                      value={selectedAccount.name}
                      onChange={(e) =>
                        setSelectedAccount({ ...selectedAccount, name: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      API Key
                    </label>
                    <input
                      type="password"
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                      value={selectedAccount.apiKey}
                      onChange={(e) =>
                        setSelectedAccount({ ...selectedAccount, apiKey: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Email
                    </label>
                    <input
                      type="email"
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                      value={selectedAccount.email}
                      onChange={(e) =>
                        setSelectedAccount({ ...selectedAccount, email: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Account ID
                    </label>
                    <input
                      type="password"
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                      value={selectedAccount.accountId}
                      onChange={(e) =>
                        setSelectedAccount({ ...selectedAccount, accountId: e.target.value })
                      }
                    />
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <button
                      onClick={saveCredentials}
                      disabled={isSaving}
                      className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                      {isSaving ? (
                        <RefreshCw className="animate-spin h-5 w-5 mr-2" />
                      ) : (
                        'Save Account'
                      )}
                    </button>
                    <button
                      onClick={() => fetchZones()}
                      disabled={loading || !selectedAccount.apiKey || !selectedAccount.email || !selectedAccount.accountId}
                      className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
                    >
                      {loading ? (
                        <RefreshCw className="animate-spin h-5 w-5 mr-2" />
                      ) : (
                        'Fetch Zones'
                      )}
                    </button>
                    {selectedAccount.id && (
                      <button
                        onClick={() => deleteAccount(selectedAccount.id)}
                        className="inline-flex items-center justify-center px-4 py-2 border border-red-300 text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                      >
                        <Trash2 className="h-5 w-5 mr-2" />
                        Delete
                      </button>
                    )}
                  </div>
                </>
              )}

              {/* Development Attribution */}
              <div className="mt-8 p-6 bg-gray-50 rounded-lg border border-gray-200">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Rule Set Attribution!</h3>
                
                <div className="space-y-4 text-sm text-gray-600">
              
                  <p>
                    Many of the foundational Cloudflare WAF rules used in this tool are inspired by the work of{' '}
                    <a 
                      href="https://webagencyhero.com/cloudflare-waf-rules-v3/" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-orange-600 hover:text-orange-700 font-medium"
                    >
                      Web Agency Hero
                    </a>
                    .
                  </p>

                  <p>
                    Huge credit to their team for sharing their expertise with the community and helping agencies protect WordPress websites at scale. If you're looking for deeper insights or advanced configurations, we highly recommend checking out their resources.
                  </p>

                  <p>
                    For a comprehensive introduction to Cloudflare's services, check out their{' '}
                    <a 
                      href="https://webagencyhero.com/beginners-guide-to-cloudflare-services-for-agencies/" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-orange-600 hover:text-orange-700 font-medium"
                    >
                      Beginner's Guide to Cloudflare services for Agencies
                    </a>
                    .
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* WAF Rules Section */}
          <div 
            className={`${
              activeTab === 'rules' ? 'block' : 'hidden'
            } md:block md:w-1/2 bg-white shadow rounded-lg p-6 mb-6 md:mb-0`}
          >
            <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-6">Core WAF Rules</h2>
            <div className="space-y-4">
              {WAFRuleDescriptions.map((rule, index) => (
                <div 
                  key={index} 
                  className="border rounded-lg overflow-hidden"
                >
                  <button
                    onClick={() => toggleRuleExpansion(rule.name)}
                    className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors duration-150"
                  >
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        {rule.name}
                      </h3>
                      <p className="text-sm text-gray-600 mt-1">
                        {rule.description}
                      </p>
                    </div>
                    {expandedRules.includes(rule.name) ? (
                      <ChevronUp className="h-5 w-5 text-gray-400 flex-shrink-0 ml-4" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-gray-400 flex-shrink-0 ml-4" />
                    )}
                  </button>
                  
                  {expandedRules.includes(rule.name) && (
                    <div className="px-4 pb-4">
                      <div className="bg-gray-50 rounded-md p-4">
                        <h4 className="text-sm font-medium text-gray-700 mb-2">
                          How it works
                        </h4>
                        <p className="text-sm text-gray-600">
                          {rule.details}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Zones Section - Now appears below in both mobile and desktop */}
        {zones.length > 0 && (
          <div 
            className={`${
              activeTab === 'zones' ? 'block' : 'hidden'
            } md:block bg-white shadow rounded-lg p-6`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <h3 className="text-lg font-medium text-gray-900">Select Zones</h3>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                <div className="relative flex-1 sm:flex-none">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search zones..."
                    value={search}
                    onChange={handleSearch}
                    className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <select
                  value={pagination.perPage}
                  onChange={handlePerPageChange}
                  className="border border-gray-300 rounded-md py-2 pl-3 pr-10 text-base focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  {perPageOptions.map(option => (
                    <option key={option} value={option}>
                      {option} per page
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Mobile Zones List */}
            <div className="md:hidden">
              <div className="space-y-4">
                {zones.map((zone) => (
                  <div key={zone.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          checked={selectedZones.includes(zone.id)}
                          onChange={() => handleZoneSelection(zone.id)}
                          disabled={zone.wafStatus === 'active'}
                        />
                        <span className="ml-3 text-sm font-medium text-gray-900">
                          {zone.name}
                        </span>
                      </div>
                    </div>
                    <div className="mt-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className={`flex items-center ${getStatusColor(zone.wafStatus)}`}>
                          {getStatusIcon(zone.wafStatus)}
                          <span className="text-sm">{getStatusText(zone.wafStatus)}</span>
                        </div>
                        {zone.wafStatus === 'active' ? (
                          <button
                            onClick={() => handleDisableWAF(zone.id)}
                            disabled={processingZones.includes(zone.id)}
                            className="inline-flex items-center px-3 py-1 border border-red-300 text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
                          >
                            {processingZones.includes(zone.id) ? (
                              <Loader2 className="animate-spin h-4 w-4 mr-1" />
                            ) : (
                              <>
                                <ShieldOff className="h-4 w-4 mr-1" />
                                Disable WAF
                              </>
                            )}
                          </button>
                        ) : zone.wafStatus !== 'active' && (
                          <button
                            onClick={() => zone.wafStatus === 'out-of-sync' ? handleResyncRules(zone.id) : handleApplyRules([zone.id])}
                            disabled={processingZones.includes(zone.id)}
                            className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                          >
                            {processingZones.includes(zone.id) ? (
                              <Loader2 className="animate-spin h-4 w-4 mr-1" />
                            ) : zone.wafStatus === 'out-of-sync' ? (
                              'Resync Rules'
                            ) : (
                              'Apply Rules'
                            )}
                          </button>
                        )}
                      </div>
                      {zone.dnsRecords && (
                        <div className="space-y-2 mt-2 pt-2 border-t">
                          {zone.dnsRecords.apex && (
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-gray-600">Root Domain</span>
                              <button
                                onClick={() => handleToggleProxy(
                                  zone.id,
                                  zone.dnsRecords.apex.id,
                                  zone.dnsRecords.apex,
                                  !zone.dnsRecords.apex.proxied
                                )}
                                disabled={processingZones.includes(zone.id)}
                                className={`inline-flex items-center px-2 py-1 border text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                                  zone.dnsRecords.apex.proxied
                                    ? 'border-orange-300 text-orange-700 bg-orange-50 hover:bg-orange-100 focus:ring-orange-500'
                                    : 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50 focus:ring-gray-500'
                                }`}
                              >
                                {zone.dnsRecords.apex.proxied ? (
                                  <Cloud className="h-4 w-4" />
                                ) : (
                                  <CloudOff className="h-4 w-4" />
                                )}
                              </button>
                            </div>
                          )}
                          {zone.dnsRecords.www && (
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-gray-600">WWW</span>
                              <button
                                onClick={() => handleToggleProxy(
                                  zone.id,
                                  zone.dnsRecords.www.id,
                                  zone.dnsRecords.www,
                                  !zone.dnsRecords.www.proxied
                                )}
                                disabled={processingZones.includes(zone.id)}
                                className={`inline-flex items-center px-2 py-1 border text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                                  zone.dnsRecords.www.proxied
                                    ? 'border-orange-300 text-orange-700 bg-orange-50 hover:bg-orange-100 focus:ring-orange-500'
                                    : 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50 focus:ring-gray-500'
                                }`}
                              >
                                WWW{' '}
                                {zone.dnsRecords.www.proxied ? (
                                  <Cloud className="h-4 w-4 ml-1" />
                                ) : (
                                  <CloudOff className="h-4 w-4 ml-1" />
                                )}
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Desktop Zones Table */}
            <div className="hidden md:block overflow-x-auto">
              <div className="inline-block min-w-full align-middle">
                <div className="border border-gray-200 rounded-lg">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="w-16 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          <div className="flex items-center">
                            <input
                              type="checkbox"
                              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                              checked={allSelectableZonesSelected}
                              onChange={(e) => handleSelectAll(e.target.checked)}
                            />
                            <span className="ml-2">All</span>
                          </div>
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Domain Name
                        </th>
                        <th scope="col" className="w-24 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          WAF Status
                        </th>
                        <th scope="col" className="w-64 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          DNS & Proxy
                        </th>
                        <th scope="col" className="w-32 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {zones.map((zone) => (
                        <tr key={zone.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <input
                              type="checkbox"
                              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                              checked={selectedZones.includes(zone.id)}
                              onChange={() => handleZoneSelection(zone.id)}
                              disabled={zone.wafStatus === 'active'}
                            />
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {zone.name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className={`flex items-center ${getStatusColor(zone.wafStatus)}`}>
                              {getStatusIcon(zone.wafStatus)}
                              <span className="text-sm">{getStatusText(zone.wafStatus)}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {renderDNSInfo(zone)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {zone.wafStatus === 'active' ? (
                              <button
                                onClick={() => handleDisableWAF(zone.id)}
                                disabled={processingZones.includes(zone.id)}
                                className="inline-flex items-center px-3 py-1 border border-red-300 text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
                              >
                                {processingZones.includes(zone.id) ? (
                                  <Loader2 className="animate-spin h-4 w-4 mr-1" />
                                ) : (
                                  <>
                                    <ShieldOff className="h-4 w-4 mr-1" />
                                    Disable WAF
                                  </>
                                )}
                              </button>
                            ) : zone.wafStatus !== 'active' && (
                              <button
                                onClick={() => zone.wafStatus === 'out-of-sync' ? handleResyncRules(zone.id) : handleApplyRules([zone.id])}
                                disabled={processingZones.includes(zone.id)}
                                className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                              >
                                {processingZones.includes(zone.id) ? (
                                  <Loader2 className="animate-spin h-4 w-4 mr-1" />
                                ) : zone.wafStatus === 'out-of-sync' ? (
                                  'Resync Rules'
                                ) : (
                                  'Apply Rules'
                                )}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mt-4">
              <div className="text-sm text-gray-700">
                Showing {((pagination.page - 1) * pagination.perPage) + 1} to{' '}
                {Math.min(pagination.page * pagination.perPage, pagination.totalCount)} of{' '}
                {pagination.totalCount} zones
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page === 1}
                  className="inline-flex items-center px-2 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-sm text-gray-700">
                  Page {pagination.page} of {totalPages}
                </span>
                <button
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page >= totalPages}
                  className="inline-flex items-center px-2 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            <button
              onClick={() => handleApplyRules(selectedZones)}
              className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
              disabled={loading || selectedZones.length === 0}
            >
              {loading ? (
                <RefreshCw className="animate-spin h-5 w-5 mr-2" />
              ) : (
                'Apply WAF Rules'
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}