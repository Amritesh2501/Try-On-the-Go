/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';

interface PosePanelProps {
  onPoseSelect: (poseInstruction: string) => void;
  isLoading: boolean;
}

const POSE_OPTIONS = [
    "Slightly turned, 3/4 view",
    "Side profile view",
    "Walking towards camera",
    "Leaning against a wall"
];

const PosePanel: React.FC<PosePanelProps> = ({ onPoseSelect, isLoading }) => {
  return (
    <div className="mt-auto pt-6 border-t">
      <h2 className="text-xl font-serif tracking-wider text-gray-800 mb-3">Change Pose</h2>
      <div className="grid grid-cols-2 gap-2">
        {POSE_OPTIONS.map((pose) => (
          <button
            key={pose}
            onClick={() => onPoseSelect(pose)}
            disabled={isLoading}
            className="w-full text-center bg-white border border-gray-300 text-gray-700 font-semibold py-2 px-3 rounded-md transition-all duration-200 ease-in-out hover:bg-gray-100 hover:border-gray-400 active:scale-95 text-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-100"
          >
            {pose}
          </button>
        ))}
      </div>
    </div>
  );
};

export default PosePanel;