interface PlaceholderPageProps {
  title: string;
  description?: string;
}

// Generic stand-in for a business screen that hasn't been built yet. Lets
// the router and layout foundation be verified end to end without pulling
// any real feature module (Auth, Users, Locations, Products, Inventory)
// forward into this phase.
export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <div className="space-y-1">
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="text-muted-foreground text-sm">
        {description ?? "This screen will be implemented in a later phase."}
      </p>
    </div>
  );
}
