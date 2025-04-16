import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

const CHANGELOG = [
  {
    version: '1.7.0',
    date: '2025-04-15',
    changes: [
      'Added version tracking for WAF templates',
      'Added version history viewer for core templates',
      'Enhanced community template sharing with improved visibility',
      'Added visual indicators for template actions (Skip, Block, Challenge)',
      'Improved template management interface',
      'Fixed community template sharing and visibility issues',
      'Added ability to share personal templates with community'
    ]
  },
  {
    version: '1.6.0',
    date: '2025-04-15',
    changes: [
      'Added comprehensive Settings area with Account, Security, and Notifications sections',
      'Implemented email notification preferences management',
      'Added two-factor authentication (2FA) support',
      'Enhanced session management with inactivity detection',
      'Added password change functionality',
      'Improved mobile responsiveness across all settings pages',
      'Added email notification system for security alerts and updates'
    ]
  },
  {
    version: '1.5.9',
    date: '2025-04-14',
    changes: [
      'Rebranded to WAFManager Pro with new orange theme',
      'Enhanced mobile responsiveness across all pages',
      'Improved WAF template management interface',
      'Added new background image to login/signup pages',
      'Added attribution footer to auth pages',
      'Updated DNS proxy status indicators',
      'Improved error handling and retry logic'
    ]
  },
  {
    version: '1.5.8',
    date: '2025-04-13',
    changes: [
      'Added ability to disable WAF rules for a zone',
      'Enhanced WAF rule comparison logic',
      'Improved error handling in edge functions',
      'Added retry mechanism for rate-limited requests',
      'Updated WAF template versioning system'
    ]
  },
  {
    version: '1.5.7',
    date: '2025-04-12',
    changes: [
      'Added community WAF templates section',
      'Implemented template creation form with improved validation',
      'Enhanced form styling with Tailwind Forms plugin',
      'Added ability for users to create and manage their own templates',
      'Improved template management interface with separate core and community sections'
    ]
  },
  {
    version: '1.5.6',
    date: '2025-04-11',
    changes: [
      'Added WAF template versioning with detailed change history',
      'Added version tracking for each template modification',
      'Enhanced template management with version display',
      'Added ability to view version history for each template',
      'Improved template organization with display order',
      'Added visual indicators for template actions (Allow, Block, Challenge)',
      'Enhanced mobile responsiveness for template management'
    ]
  },
  {
    version: '1.5.5',
    date: '2025-04-10',
    changes: [
      'Added DNS proxy status indicators for root and www domains',
      'Added ability to toggle DNS proxy status directly from the interface',
      'Improved WAF status display with "Out of Sync" state',
      'Added resync capability for out-of-sync WAF rules',
      'Enhanced mobile interface with better zone management',
      'Added retry logic for API requests to handle rate limiting',
      'Improved error handling and user feedback'
    ]
  },
  {
    version: '1.5.0',
    date: '2025-04-09',
    changes: [
      'Initial release of WAF template management',
      'Added core WAF rules for common security scenarios',
      'Implemented WAF rule application across multiple zones',
      'Added zone filtering and pagination',
      'Basic account management functionality'
    ]
  }
];

export default function Changelog() {
  return (
    <div className="max-w-4xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center space-x-4 mb-6">
          <Link
            to="/dashboard"
            className="inline-flex items-center text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Changelog</h1>
        </div>

        <div className="space-y-8">
          {CHANGELOG.map((release) => (
            <div key={release.version} className="relative">
              <div className="flex items-baseline space-x-4">
                <h2 className="text-lg font-semibold text-orange-600">
                  v{release.version}
                </h2>
                <span className="text-sm text-gray-500">{release.date}</span>
              </div>
              <div className="mt-3 ml-4 space-y-3">
                {release.changes.map((change, index) => (
                  <div
                    key={index}
                    className="flex items-start"
                  >
                    <div className="relative flex h-6 items-center">
                      <div className="absolute left-0 h-full w-px bg-gray-200 -ml-px"></div>
                      <div className="relative h-2 w-2 rounded-full bg-gray-300"></div>
                    </div>
                    <p className="ml-4 text-gray-700">{change}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}