import { useState } from 'react';
import type { Region } from '../../data/types';
import { DistributionView } from './DistributionView';
import { TrendChart } from './TrendChart';

type SubView = 'distribution' | 'trend';

interface HistoricalViewProps {
  region: Region;
}

export function HistoricalView({ region }: HistoricalViewProps) {
  const [subView, setSubView] = useState<SubView>('distribution');

  return (
    <>
      <div className="page-header">
        <div className="page-title">
          Rank Distribution History ({region === 'EU' ? 'EUW' : 'NA'})
        </div>
      </div>

      {subView === 'distribution' ? (
        <DistributionView
          region={region}
          onViewChange={view => setSubView(view)}
        />
      ) : (
        <TrendChart
          region={region}
          onViewChange={view => setSubView(view)}
        />
      )}
    </>
  );
}
