import { Navigate, useLocation, useSearchParams } from 'react-router';
import { TOYS } from '../../lib/domain';

/** Compatibility for old bookmarks. There is only one play screen: Home. */
export function Toy() {
  const [params] = useSearchParams(); const location = useLocation();
  const type = params.get('type');
  return <Navigate replace to={`/?play=${type && Object.hasOwn(TOYS, type) ? type : 'SQUISHY'}`} state={location.state} />;
}
