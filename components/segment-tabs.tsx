'use client';

interface SegmentTabsProps {
  activeSegment: 'hot' | 'warm' | 'cold' | 'all';
  onSegmentChange: (segment: 'hot' | 'warm' | 'cold' | 'all') => void;
}

export function SegmentTabs({ activeSegment, onSegmentChange }: SegmentTabsProps) {
  const getActiveClasses = (value: string) => {
    if (activeSegment !== value) {
      return 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300';
    }
    
    switch (value) {
      case 'hot':
        return 'border-red-500 text-red-600';
      case 'warm':
        return 'border-yellow-500 text-yellow-600';
      case 'cold':
        return 'border-blue-500 text-blue-600';
      default:
        return 'border-gray-500 text-gray-600';
    }
  };

  const segments = [
    { value: 'all' as const, label: 'All' },
    { value: 'hot' as const, label: 'Hot' },
    { value: 'warm' as const, label: 'Warm' },
    { value: 'cold' as const, label: 'Cold' },
  ];

  return (
    <div className="border-b border-gray-200">
      <nav className="-mb-px flex space-x-8" aria-label="Tabs">
        {segments.map((segment) => {
          return (
            <button
              key={segment.value}
              onClick={() => onSegmentChange(segment.value)}
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${getActiveClasses(segment.value)}`}
            >
              {segment.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

