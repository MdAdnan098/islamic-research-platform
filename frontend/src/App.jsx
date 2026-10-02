import { BrowserRouter } from "react-router-dom";
import { I18nProvider } from "./i18n/index.jsx";
import { ThemeProvider } from "./context/ThemeContext.jsx";
import { AppRouter } from "./app/router.jsx";

export default function App() {
  return (
    <ThemeProvider>
      <I18nProvider>
        <BrowserRouter>
          <AppRouter />
        </BrowserRouter>
      </I18nProvider>
    </ThemeProvider>
  );
}
