import { Icon, type IconName } from './Icon.tsx';

export function StatCard({
  icon,
  value,
  label,
  trend,
}: {
  icon: IconName;
  value: string | number;
  label: string;
  trend?: string;
}): JSX.Element {
  return (
    <div className="stat">
      <div className="stat__icon">
        <Icon name={icon} size={18} />
      </div>
      <div className="stat__value">{value}</div>
      <div className="stat__label">{label}</div>
      {trend && <div className="stat__trend">{trend}</div>}
    </div>
  );
}
