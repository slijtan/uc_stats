import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import Header from "./components/layout/Header.tsx";
import Footer from "./components/layout/Footer.tsx";
import ByCollegePage from "./pages/ByCollegePage.tsx";
import SchoolDetailPage from "./pages/SchoolDetailPage.tsx";
import ComparisonPage from "./pages/ComparisonPage.tsx";
import SchoolVsSchoolPage from "./pages/SchoolVsSchoolPage.tsx";
import MultiComparePage from "./pages/MultiComparePage.tsx";
import DataQualityPage from "./pages/DataQualityPage.tsx";
import EquityAnalysisPage from "./pages/EquityAnalysisPage.tsx";

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
          <Route path="/" element={<ByCollegePage />} />
          <Route path="/by-college" element={<Navigate to="/" replace />} />
          <Route path="/public-vs-private" element={<ComparisonPage />} />
          <Route path="/school" element={<SchoolDetailPage />} />
          <Route path="/school/:schoolId" element={<SchoolDetailPage />} />
          <Route path="/compare" element={<Navigate to="/public-vs-private" replace />} />
          <Route
            path="/compare/:schoolId1/:schoolId2"
            element={<SchoolVsSchoolPage />}
          />
          <Route path="/multi-compare" element={<MultiComparePage />} />
          <Route path="/equity" element={<EquityAnalysisPage />} />
          <Route path="/data-quality" element={<DataQualityPage />} />
        </Routes>
      </Layout>
    </HashRouter>
  );
}

export default App;
