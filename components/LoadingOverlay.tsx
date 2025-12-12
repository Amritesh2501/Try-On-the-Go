
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';
import ProcessingLoader from './ProcessingLoader';

interface LoadingOverlayProps {
  message: string;
}

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ message }) => {
  return (
    <div className="absolute inset-0 bg-white/90 dark:bg-stone-950/90 flex items-center justify-center backdrop-blur-md animate-fade-in z-50">
        <ProcessingLoader message={message} subMessage="This might take a moment..." />
    </div>
  );
};

export default LoadingOverlay;
