export default function Layout(props: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <main className="flex-1">{props.children}</main>
    </div>
  );
}
