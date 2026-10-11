import React from 'react';
import { Trash2 } from 'lucide-react';

interface BudgetProgressBarProps {
  categoryName: string;
  spent: number;
  limit: number;
  icon?: string;
  color?: string;
  onDelete?: () => void;
  className?: string;
}

export const BudgetProgressBar: React.FC<BudgetProgressBarProps> = ({
  categoryName,
  spent,
  limit,
  color = '#10b981',
  onDelete,
  className,
}) => {
  const percent = limit > 0 ? Math.min(100, Math.round((spent / limit) * 100)) : 0;
  const isOver = limit > 0 && spent > limit;
  const isNear = limit > 0 && percent >= 80 && !isOver;

  let badgeStyle = 'bg-green-500/10 text-green-700 border-green-500/20';
  let badgeText = 'Healthy';
  let barColor = 'bg-green-600';

  if (isOver) {
    badgeStyle = 'bg-red-500/10 text-red-700 border-red-500/20';
    badgeText = 'Over limit';
    barColor = 'bg-red-500';
  } else if (isNear) {
    badgeStyle = 'bg-amber-500/10 text-amber-700 border-amber-500/20';
    badgeText = 'Near max';
    barColor = 'bg-amber-500';
  } else if (percent === 0) {
    badgeStyle = 'bg-black/[0.04] text-gray-500 border-black/[0.05]';
    badgeText = 'No spend';
    barColor = 'bg-gray-300';
  }

  const remaining = Math.max(0, limit - spent);

  return (
    <div className={className || "card-base p-3.5 flex flex-col justify-between"}>
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center gap-2">
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0 shadow-xs"
            style={{ backgroundColor: color }}
          />
          <span className="text-xs font-semibold text-gray-900 tracking-tight">
            {categoryName}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full border ${badgeStyle}`}>
            {badgeText}
          </span>
          {onDelete && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="text-gray-400 hover:text-red-600 p-0.5 -mr-1 rounded transition-colors cursor-pointer"
              title="Delete Category"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="flex justify-between items-baseline mb-1.5">
        <span className="text-sm font-mono-num font-bold text-gray-900">
          ₹{spent.toLocaleString('en-IN')}
        </span>
        <span className="text-[11px] font-medium text-gray-400">
          Max: ₹{limit.toLocaleString('en-IN')}
        </span>
      </div>

      {/* Progress track */}
      <div className="h-2 w-full bg-black/[0.04] rounded-full overflow-hidden p-0.5">
        <div
          className={`h-full rounded-full transition-all duration-500 ease-out ${barColor}`}
          style={{ width: `${percent}%` }}
        />
      </div>

      <div className="flex justify-between items-center mt-2 text-[10px] font-medium text-gray-400">
        <span>{limit === 0 ? 'No max' : `${percent}% utilized`}</span>
        <span>{limit > 0 ? `₹${remaining.toLocaleString('en-IN')} left` : ''}</span>
      </div>
    </div>
  );
};
