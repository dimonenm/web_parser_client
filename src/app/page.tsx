import styles from "./page.module.css";

export default function Home() {
  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <a href="/" className={styles.logo}>
          <div className={styles.logo-icon}>P</div>
          <span className={styles.logo-text}>Pixnoy</span>
        </a>
        
        <nav className={styles.nav}>
          <a href="/popular" className={styles.nav-link}>Popular</a>
          <a href="/top-instagram" className={styles.nav-link}>Top Instagram</a>
          
          <div className={styles.language-selector}>
            <svg 
              className={styles.globe-icon} 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M2 12h20" />
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
            <span>English</span>
          </div>
        </nav>
      </header>

      {/* Main Content */}
      <main className={styles.main-content}>
        <h1 className={styles.title}>Instagram viewer and downloader</h1>
        <p className={styles.subtitle}>
          Anonymously view and download Instagram photos and videos from profiles, 
          posts and stories without login.
        </p>

        {/* Search Form */}
        <form className={styles.search-form} onSubmit={(e) => e.preventDefault()}>
          <input 
            type="text" 
            className={styles.search-input}
            placeholder="Search or paste the Instagram URL"
          />
          <button type="submit" className={styles.search-button}>
            <svg 
              className={styles.search-icon} 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            Search
          </button>
        </form>
      </main>
    </div>
  );
}