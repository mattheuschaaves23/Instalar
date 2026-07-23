import { useEffect, useState } from 'react';
import api from '../services/api';

const DEFAULT_CAPABILITIES = {
  password_reset: false,
  oauth: { google: false },
};

export default function useAuthCapabilities() {
  const [capabilities, setCapabilities] = useState(DEFAULT_CAPABILITIES);

  useEffect(() => {
    let isMounted = true;

    api.get('/auth/capabilities')
      .then((response) => {
        if (!isMounted) return;
        setCapabilities({
          password_reset: Boolean(response.data?.password_reset),
          oauth: {
            google: Boolean(response.data?.oauth?.google),
          },
        });
      })
      .catch(() => null);

    return () => {
      isMounted = false;
    };
  }, []);

  return capabilities;
}
