import { useEffect, useState } from 'react';
import { Stack, useRouter, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { useAuth } from '@/hooks/useAuth';
import { View, Text, ActivityIndicator } from 'react-native';

export default function RootLayout() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  useFrameworkReady();
  const [initialPath, setInitialPath] = useState(null);
  const [isHandlingRedirect, setIsHandlingRedirect] = useState(false);

  // Capturer l'URL initiale au premier rendu
  useEffect(() => {
    if (!initialPath) {
      const currentPath = pathname || (typeof window !== 'undefined' ? window.location.pathname : '');
      console.log('Captured initial path in RootLayout:', currentPath);
      setInitialPath(currentPath);
    }
  }, [pathname]);

  // Réinitialiser initialPath lors de la déconnexion
  useEffect(() => {
    if (!user && !loading) {
      console.log('User logged out, resetting initialPath');
      setInitialPath(null);
    }
  }, [user, loading]);

  // Effet de redirection
  useEffect(() => {
    if (loading || isHandlingRedirect) return; // Attendre que le chargement soit terminé et éviter les redirections multiples

    // Commencer le processus de redirection
    setIsHandlingRedirect(true);

    const isDetailRoute = (path) => {
      const detailRoutePattern = /^\/(event|report|communities\/post)\/[^/]+$/;
      return path && typeof path === 'string' && detailRoutePattern.test(path);
    };

    const isTabRoute = (path) => {
      const tabRoutePattern = /^\/(map|community|reports|events|menu)$/;
      return path && typeof path === 'string' && tabRoutePattern.test(path);
    };

    // Fonction pour gérer la redirection avec un délai minimal
    const handleRedirection = async () => {
      try {
        // Si l'utilisateur n'est pas connecté, rediriger vers /sign-in
        if (!user) {
          console.log('No user, redirecting to sign-in');
          await router.replace({
            pathname: '/(auth)/sign-in',
            params: { redirect: initialPath || '' },
          });
        } else {
          // Si l'utilisateur est connecté
          const isAuthRoute = initialPath?.includes('(auth)');

          // Si aucune navigation précédente n'est possible ou route d'auth
          if (!router.canGoBack() || isAuthRoute) {
            if (initialPath && isDetailRoute(initialPath)) {
              console.log('Redirecting to initial detail path:', initialPath);
              await router.replace(initialPath);
            } else if (initialPath && isTabRoute(initialPath)) {
              console.log('Redirecting to initial tab path:', initialPath);
              const tabName = initialPath.replace('/', '');
              await router.replace(`/(tabs)/${tabName}`);
            } else {
              console.log('Redirecting to default path: /map');
              await router.replace('/(tabs)/map');
            }
          }
        }
      } finally {
        // Fin du processus de redirection
        setIsHandlingRedirect(false);
      }
    };

    handleRedirection();
  }, [user, loading, router, initialPath, isHandlingRedirect]);

  // Afficher un écran de chargement pendant que l'état d'authentification est vérifié
  // ou pendant qu'une redirection est en cours
  if (loading || isHandlingRedirect) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f5f5' }}>
        <ActivityIndicator size="large" color="#6200ea" />
        <Text style={{ marginTop: 16, fontSize: 16, color: '#333' }}>Chargement...</Text>
      </View>
    );
  }

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="report/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="event/[eventId]" options={{ headerShown: false }} />
        <Stack.Screen name="communities/category/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="communities/new-post" options={{ headerShown: false }} />
        <Stack.Screen name="communities/post/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="+not-found" options={{ title: 'Oops!' }} />
      </Stack>
      <StatusBar style="auto" />
    </>
  );
}