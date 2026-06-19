import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  IoTitle,
  SectionLabel,
  SegmentedControl,
} from "../components/ui/primitives";
import { OverviewTab } from "../components/admin/OverviewTab";
import { UsersTab } from "../components/admin/UsersTab";
import { ContentTab } from "../components/admin/ContentTab";
import { SecurityTab } from "../components/admin/SecurityTab";

type Tab = "OVERVIEW" | "USERS" | "CONTENT" | "SECURITY";

const TABS: { value: Tab; label: string }[] = [
  { value: "OVERVIEW", label: "Overview" },
  { value: "USERS", label: "Users" },
  { value: "CONTENT", label: "Content" },
  { value: "SECURITY", label: "Security" },
];

export const AdminDashboard = () => {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>("OVERVIEW");

  return (
    <div className="pt-6">
      <div className="flex items-center gap-3.5 flex-wrap mb-4">
        <IoTitle as="h1" className="text-4xl">
          {t("nav.admin")} Dashboard
        </IoTitle>
        <SectionLabel>Ops</SectionLabel>
      </div>

      <div className="flex gap-3.5 flex-wrap items-center mb-5">
        <SegmentedControl<Tab>
          value={tab}
          onValueChange={setTab}
          options={TABS}
          aria-label="Admin section"
        />
      </div>

      {tab === "OVERVIEW" && <OverviewTab />}
      {tab === "USERS" && <UsersTab />}
      {tab === "CONTENT" && <ContentTab />}
      {tab === "SECURITY" && <SecurityTab />}
    </div>
  );
};
