import React from 'react';

export default function AuthFooter() {
  return (
    <div className="mt-8 pt-6 border-t border-gray-200">
      <div className="text-center text-sm text-gray-500">
        <p className="mb-2">
          Developed by{' '}
          <a 
            href="https://shadowtek.com.au" 
            target="_blank" 
            rel="noopener noreferrer"
            className="font-medium text-orange-600 hover:text-orange-500"
          >
            Shadowtek Web Solutions
          </a>
        </p>
        <p>
          Trusted by{' '}
          <a 
            href="https://signatureit.com.au" 
            target="_blank" 
            rel="noopener noreferrer"
            className="font-medium text-orange-600 hover:text-orange-500"
          >
            SignatureIT
          </a>
          {' '}and other leading web agencies
        </p>
      </div>
    </div>
  );
}