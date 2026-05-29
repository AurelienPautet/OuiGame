/**
 * Custom Tabs component matching the original OUI TANK design
 * Features: folder-tab shape, rounded top corners, active/inactive states, bigger gaps
 */

export const Tabs = ({ tabs, activeTab, onTabChange, className = "" }) => {
  return (
    <div className={`flex w-full ${className}`}>
      {tabs.map((tab, index) => (
        <button
          key={tab.value}
          onClick={() => onTabChange(tab.value)}
          className={`
            flex-1 py-3 px-4 
            text-center font-semibold uppercase text-white
            rounded-t-lg transition-colors
            ${index > 0 ? "ml-2" : ""}
            ${
              activeTab === tab.value
                ? "bg-base-100"
                : "bg-base-200 hover:bg-base-300"
            }
          `}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
};

// For single tab usage (like login/register)
export const Tab = ({
  active,
  onClick,
  children,
  className = "",
  first = false,
}) => {
  return (
    <button
      onClick={onClick}
      className={`
        flex-1 py-3 px-4 
        text-center font-semibold uppercase text-white
        rounded-t-lg transition-colors
        ${!first ? "ml-2" : ""}
        ${active ? "bg-base-100" : "bg-base-200 hover:bg-base-300"}
        ${className}
      `}
    >
      {children}
    </button>
  );
};

export const TabList = ({ children, className = "" }) => {
  return <div className={`flex w-full ${className}`}>{children}</div>;
};
