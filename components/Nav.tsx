import PublicHeader from './public-header';

// Focused-flow compatibility wrapper: do not advertise starting the quiz inside it.
export default function Nav() {
  return <PublicHeader focused />;
}
