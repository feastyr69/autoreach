import { ArrowRight } from 'lucide-react';
import type { StageState } from '../types';
import StageCard from './StageCard';

interface PipelineStepperProps {
  stages: StageState[];
}

export default function PipelineStepper({ stages }: PipelineStepperProps) {
  return (
    <div className="bg-zinc-900/80 border border-zinc-800/60 rounded-2xl p-6 backdrop-blur-sm">
      <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider mb-5">
        Pipeline Stages
      </h2>

      <div className="grid grid-cols-4 gap-3 relative">
        {stages.map((stage, index) => (
          <div key={stage.id} className="relative flex items-stretch">
            <div className="flex-1">
              <StageCard stage={stage} index={index} />
            </div>

            {/* Connector arrow */}
            {index < stages.length - 1 && (
              <div className="absolute -right-3 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center w-6">
                <ArrowRight
                  className={`w-4 h-4 transition-colors duration-500 ${
                    stages[index + 1].status !== 'idle' ? 'text-violet-400' : 'text-zinc-700'
                  }`}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
