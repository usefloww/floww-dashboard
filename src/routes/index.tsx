import { createFileRoute } from "@tanstack/react-router";
import { BaseCard } from "@/components/BaseCard";

interface NavigationItem {
  name: string;
  description: string;
  to: string;
  params?: Record<string, string>;
}

const navigationItems: NavigationItem[] = [
  {
    name: "Workflows",
    description: "View and manage your workflows across all organizations",
    to: "/workflows",
  },
  {
    name: "Providers",
    description: "Connect and manage your cloud providers and services",
    to: "/providers",
  },
  {
    name: "Organization Settings",
    description: "Configure your organization, users, and application preferences",
    to: "/settings",
  },
];

function NavigationCard({ item }: { item: NavigationItem }) {
  return (
    <BaseCard to={item.to as any} params={item.params as any}>
      <h2 className="text-2xl font-bold text-foreground">{item.name}</h2>
      <p className="text-muted-foreground text-sm">{item.description}</p>
    </BaseCard>
  );
}

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  return (
    <div className="container mx-auto py-12 px-4">
      <div className="text-center mb-16">
        <h1 className="text-5xl font-bold m-6 bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
          Welcome to Floww
        </h1>
        <div className="text-md text-muted-foreground max-w-2xl mx-auto text-middle">
          Your central hub for managing workflows, organizations, and automating
          your development processes.
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {navigationItems.map((item) => (
          <NavigationCard key={item.name} item={item} />
        ))}
      </div>


    </div>
  );
}
