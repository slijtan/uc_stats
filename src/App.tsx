import { HashRouter, Routes, Route } from "react-router-dom";
import Header from "./components/layout/Header.tsx";
import Footer from "./components/layout/Footer.tsx";
import LandingPage from "./pages/LandingPage.tsx";
import ByCollegePage from "./pages/ByCollegePage.tsx";
import SchoolDetailPage from "./pages/SchoolDetailPage.tsx";
import ComparisonPage from "./pages/ComparisonPage.tsx";
import SchoolVsSchoolPage from "./pages/SchoolVsSchoolPage.tsx";
import MultiComparePage from "./pages/MultiComparePage.tsx";
import DataQualityPage from "./pages/DataQualityPage.tsx";

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-layout">
      <a href="#main-content" className="skip-to-content">
        Skip to main content
      </a>
      <Header />
      <main id="main-content" className="app-main" tabIndex={-1}>
        {children}
      </main>
      <Footer />
    </div>
  );
}

function App() {
  return (
    <HashRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/by-college" element={<ByCollegePage />} />
          <Route path="/school/:schoolId" element={<SchoolDetailPage />} />
          <Route path="/compare" element={<ComparisonPage />} />
          <Route
            path="/compare/:schoolId1/:schoolId2"
            element={<SchoolVsSchoolPage />}
          />
          <Route path="/multi-compare" element={<MultiComparePage />} />
          <Route path="/data-quality" element={<DataQualityPage />} />
        </Routes>
      </Layout>
    </HashRouter>
  );
}

export default App;
