export default function HomePage() {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        background: 'linear-gradient(160deg,#0f172a,#1e293b)',
        color: '#f8fafc',
      }}
    >
      <h1 style={{ fontSize: '2rem', marginBottom: 12 }}>Cloud Signage</h1>
      <p style={{ maxWidth: 520, textAlign: 'center', opacity: 0.85 }}>
        Public marketing site placeholder. Replace this page with content from Strapi or
        static MDX. See docs/strapi-marketing.md.
      </p>
    </main>
  );
}
