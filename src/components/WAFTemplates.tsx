import React, { useState, useEffect } from 'react';
import { ArrowLeft, FileEdit, Plus, Trash2, History } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

interface WAFTemplate {
  id: string;
  name: string;
  description: string;
  expression: string;
  action: string;
  action_parameters?: any;
  is_core: boolean;
  is_community: boolean;
  version: number;
  created_by?: string;
  target_countries?: string[];
  created_at: string;
  updated_at: string;
}

interface TemplateVersion {
  id: string;
  version: number;
  name: string;
  description: string;
  expression: string;
  action: string;
  modified_at: string;
  modified_by?: string;
}

type TabType = 'core' | 'community' | 'my-templates';

export default function WAFTemplates() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('core');
  const [templates, setTemplates] = useState<WAFTemplate[]>([]);
  const [versions, setVersions] = useState<Record<string, TemplateVersion[]>>({});
  const [loading, setLoading] = useState(false);
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [showVersionHistory, setShowVersionHistory] = useState<string | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<WAFTemplate | null>(null);
  const [templateForm, setTemplateForm] = useState({
    name: '',
    description: '',
    expression: '',
    action: 'managed_challenge',
    action_parameters: null,
    is_community: true,
    is_core: false,
    target_countries: ['AU']
  });

  useEffect(() => {
    loadTemplates();
  }, [activeTab, user]);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('waf_templates')
        .select('*')
        .order('display_order', { ascending: true });

      if (activeTab === 'core') {
        query = query.eq('is_core', true);
      } else if (activeTab === 'community') {
        query = query.eq('is_community', true).eq('is_core', false);
      } else if (activeTab === 'my-templates' && user?.email) {
        query = query.eq('created_by', user.email);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error loading templates:', error);
        throw error;
      }

      setTemplates(data || []);

      // Load versions for core templates
      if (activeTab === 'core') {
        const versionsData: Record<string, TemplateVersion[]> = {};
        for (const template of data || []) {
          const { data: templateVersions, error: versionsError } = await supabase
            .from('waf_template_versions')
            .select('*')
            .eq('template_id', template.id)
            .order('version', { ascending: false });

          if (!versionsError && templateVersions) {
            versionsData[template.id] = templateVersions;
          }
        }
        setVersions(versionsData);
      }
    } catch (error) {
      console.error('Error in loadTemplates:', error);
      toast.error('Failed to load WAF templates');
    } finally {
      setLoading(false);
    }
  };

  const handleTemplateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const templateData = {
        ...templateForm,
        is_core: false,
        is_community: true,
        created_by: user?.email,
        target_countries: templateForm.target_countries || ['AU']
      };

      if (editingTemplate) {
        const { error } = await supabase
          .from('waf_templates')
          .update({
            ...templateData,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingTemplate.id);

        if (error) {
          console.error('Update error:', error);
          throw error;
        }
        toast.success('Template updated successfully');
      } else {
        const { error } = await supabase
          .from('waf_templates')
          .insert([templateData]);

        if (error) {
          console.error('Insert error:', error);
          throw error;
        }
        toast.success('Template created successfully');
      }

      setShowTemplateForm(false);
      setEditingTemplate(null);
      setTemplateForm({
        name: '',
        description: '',
        expression: '',
        action: 'managed_challenge',
        action_parameters: null,
        is_community: true,
        is_core: false,
        target_countries: ['AU']
      });
      loadTemplates();
    } catch (error) {
      console.error('Error saving template:', error);
      toast.error('Failed to save template');
    } finally {
      setLoading(false);
    }
  };

  const handleEditTemplate = (template: WAFTemplate) => {
    setEditingTemplate(template);
    setTemplateForm({
      name: template.name,
      description: template.description,
      expression: template.expression,
      action: template.action,
      action_parameters: template.action_parameters,
      is_community: template.is_community,
      is_core: template.is_core,
      target_countries: template.target_countries || ['AU']
    });
    setShowTemplateForm(true);
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;

    try {
      const { error } = await supabase
        .from('waf_templates')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Template deleted successfully');
      loadTemplates();
    } catch (error) {
      console.error('Error deleting template:', error);
      toast.error('Failed to delete template');
    }
  };

  const handleShareWithCommunity = async (template: WAFTemplate) => {
    try {
      const { error } = await supabase
        .from('waf_templates')
        .update({
          is_community: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', template.id);

      if (error) throw error;
      toast.success('Template shared with community successfully');
      loadTemplates();
    } catch (error) {
      console.error('Error sharing template:', error);
      toast.error('Failed to share template');
    }
  };

  const canEditTemplate = (template: WAFTemplate) => {
    if (user?.email === 'steve@shadowtek.com.au') return true;
    return template.created_by === user?.email && !template.is_core;
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-AU', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getActionBadgeStyle = (action: string) => {
    switch (action) {
      case 'skip':
        return 'bg-blue-100 text-blue-800 border border-blue-200';
      case 'block':
        return 'bg-red-100 text-red-800 border border-red-200';
      case 'managed_challenge':
        return 'bg-yellow-100 text-yellow-800 border border-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800 border border-gray-200';
    }
  };

  const formatActionName = (action: string) => {
    return action
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
      <div className="flex items-center space-x-4 mb-6">
        <Link
          to="/dashboard"
          className="inline-flex items-center text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">WAF Templates</h1>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('core')}
              className={`
                py-4 px-1 inline-flex items-center border-b-2 font-medium text-sm
                ${activeTab === 'core'
                  ? 'border-orange-500 text-orange-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }
              `}
            >
              Core Templates
            </button>
            <button
              onClick={() => setActiveTab('community')}
              className={`
                py-4 px-1 inline-flex items-center border-b-2 font-medium text-sm
                ${activeTab === 'community'
                  ? 'border-orange-500 text-orange-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }
              `}
            >
              Community Templates
            </button>
            <button
              onClick={() => setActiveTab('my-templates')}
              className={`
                py-4 px-1 inline-flex items-center border-b-2 font-medium text-sm
                ${activeTab === 'my-templates'
                  ? 'border-orange-500 text-orange-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }
              `}
            >
              My Templates
            </button>
          </nav>
        </div>

        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <p className="text-sm text-gray-500">
              {activeTab === 'core' 
                ? 'Core templates are managed by the WAFManager Pro team and provide essential security rules.'
                : activeTab === 'community'
                ? 'Community templates are created and shared by the WAFManager Pro community.'
                : 'Manage your personal WAF templates here.'}
            </p>
            {(activeTab === 'my-templates' || activeTab === 'community' || user?.email === 'steve@shadowtek.com.au') && (
              <button
                onClick={() => {
                  setEditingTemplate(null);
                  setTemplateForm({
                    name: '',
                    description: '',
                    expression: '',
                    action: 'managed_challenge',
                    action_parameters: null,
                    is_community: true,
                    is_core: false,
                    target_countries: ['AU']
                  });
                  setShowTemplateForm(true);
                }}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
              >
                <Plus className="h-5 w-5 mr-2" />
                Add Template
              </button>
            )}
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
            </div>
          ) : templates.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No templates found in this category.
            </div>
          ) : (
            <div className="space-y-4">
              {templates.map((template) => (
                <div
                  key={template.id}
                  className="border border-gray-200 rounded-lg p-4"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="text-sm font-medium text-gray-900">
                        {template.name}
                        {template.is_core && (
                          <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            Core
                          </span>
                        )}
                        {template.is_community && !template.is_core && (
                          <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Community
                          </span>
                        )}
                        <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          v{template.version}
                        </span>
                      </h4>
                      <p className="mt-1 text-sm text-gray-500">{template.description}</p>
                    </div>
                    <div className="flex space-x-2">
                      {template.is_core && (
                        <button
                          onClick={() => setShowVersionHistory(template.id)}
                          className="inline-flex items-center p-1 border border-transparent rounded-full text-gray-400 hover:text-gray-500"
                          title="View version history"
                        >
                          <History className="h-5 w-5" />
                        </button>
                      )}
                      {canEditTemplate(template) && (
                        <>
                          {activeTab === 'my-templates' && !template.is_community && (
                            <button
                              onClick={() => handleShareWithCommunity(template)}
                              className="inline-flex items-center px-3 py-1 border border-transparent rounded-md text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                              title="Share with community"
                            >
                              Share with Community
                            </button>
                          )}
                          <button
                            onClick={() => handleEditTemplate(template)}
                            className="inline-flex items-center p-1 border border-transparent rounded-full text-gray-400 hover:text-gray-500"
                            title="Edit template"
                          >
                            <FileEdit className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => handleDeleteTemplate(template.id)}
                            className="inline-flex items-center p-1 border border-transparent rounded-full text-red-400 hover:text-red-500"
                            title="Delete template"
                          >
                            <Trash2 className="h-5 w-5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="mt-2">
                    <div className="text-xs font-medium text-gray-500">Expression:</div>
                    <pre className="mt-1 text-xs text-gray-600 bg-gray-50 p-2 rounded overflow-x-auto">
                      {template.expression}
                    </pre>
                  </div>
                  <div className="mt-2 flex items-center">
                    <div className="text-xs font-medium text-gray-500">Action:</div>
                    <span className={`ml-2 inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getActionBadgeStyle(template.action)}`}>
                      {formatActionName(template.action)}
                    </span>
                  </div>
                  <div className="mt-2 text-xs text-gray-500">
                    {template.created_by && (
                      <div>Created by: {template.created_by}</div>
                    )}
                    <div>Last updated: {formatDate(template.updated_at)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {showTemplateForm && (
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4">
              <div className="bg-white rounded-lg p-6 max-w-2xl w-full">
                <h4 className="text-lg font-medium text-gray-900 mb-4">
                  {editingTemplate ? 'Edit Template' : 'New Template'}
                </h4>
                <form onSubmit={handleTemplateSubmit} className="space-y-4">
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                      Name
                    </label>
                    <input
                      type="text"
                      id="name"
                      value={templateForm.name}
                      onChange={(e) => setTemplateForm({...templateForm, name: e.target.value})}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500 sm:text-sm"
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                      Description
                    </label>
                    <textarea
                      id="description"
                      value={templateForm.description}
                      onChange={(e) => setTemplateForm({...templateForm, description: e.target.value})}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500 sm:text-sm"
                      rows={3}
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="expression" className="block text-sm font-medium text-gray-700">
                      Expression
                    </label>
                    <textarea
                      id="expression"
                      value={templateForm.expression}
                      onChange={(e) => setTemplateForm({...templateForm, expression: e.target.value})}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500 sm:text-sm"
                      rows={3}
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="action" className="block text-sm font-medium text-gray-700">
                      Action
                    </label>
                    <select
                      id="action"
                      value={templateForm.action}
                      onChange={(e) => setTemplateForm({...templateForm, action: e.target.value})}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500 sm:text-sm"
                    >
                      <option value="managed_challenge">Managed Challenge</option>
                      <option value="block">Block</option>
                      <option value="skip">Skip</option>
                    </select>
                  </div>

                  <div className="flex justify-end space-x-3">
                    <button
                      type="button"
                      onClick={() => {
                        setShowTemplateForm(false);
                        setEditingTemplate(null);
                      }}
                      className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
                    >
                      {loading ? (
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                      ) : (
                        'Save Template'
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {showVersionHistory && (
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4">
              <div className="bg-white rounded-lg p-6 max-w-2xl w-full">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="text-lg font-medium text-gray-900">Version History</h4>
                  <button
                    onClick={() => setShowVersionHistory(null)}
                    className="text-gray-400 hover:text-gray-500"
                  >
                    <span className="sr-only">Close</span>
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {versions[showVersionHistory]?.map((version) => (
                    <div key={version.id} className="border-b border-gray-200 pb-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h5 className="text-sm font-medium text-gray-900">
                            Version {version.version}
                            <span className="ml-2 text-xs text-gray-500">
                              {formatDate(version.modified_at)}
                            </span>
                          </h5>
                          {version.modified_by && (
                            <p className="text-xs text-gray-500">
                              Modified by: {version.modified_by}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="mt-2">
                        <p className="text-sm text-gray-600">{version.description}</p>
                        <pre className="mt-1 text-xs text-gray-600 bg-gray-50 p-2 rounded overflow-x-auto">
                          {version.expression}
                        </pre>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}