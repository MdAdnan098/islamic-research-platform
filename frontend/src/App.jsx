import { BrowserRouter } from "react-router-dom";
import { I18nProvider } from "./i18n/index.jsx";
import { ThemeProvider } from "./context/ThemeContext.jsx";
import { FontSizeProvider } from "./context/FontSizeContext.jsx";
import { AppRouter } from "./app/router.jsx";
import { ErrorBoundary } from "./components/ui/ErrorBoundary.jsx";

export default function App() {
  return (
    <ThemeProvider>
      <I18nProvider>
        <FontSizeProvider>
          <BrowserRouter>
            <ErrorBoundary><AppRouter /></ErrorBoundary>
          </BrowserRouter>
        </FontSizeProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}
