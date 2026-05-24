import { createBrowserRouter, RouterProvider, Outlet } from 'react-router';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Landing from './pages/Landing';
import LogInput from './pages/LogInput';
import Processing from './pages/Processing';
import Results from './pages/Results';

function Layout() {
  return (
    <>
      <Navbar />
      <Outlet />
      <Footer />
    </>
  );
}

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <Landing /> },
      { path: '/analyze', element: <LogInput /> },
      { path: '/processing', element: <Processing /> },
      { path: '/results', element: <Results /> },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
