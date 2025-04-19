import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Variables globales pour centraliser l'état de l'authentification
let globalUser = null;
let globalLoading = true;
let authListeners = [];
let globalAuthListener = null;

export const useAuth = () => {
  const [user, setUser] = useState(globalUser);
  const [loading, setLoading] = useState(globalLoading);

  const fetchUser = async (session) => {
    try {
      if (!session) {
        console.log('Aucune session active trouvée.');
        globalUser = null;
        authListeners.forEach((listener) => listener.setUser(null));
        globalLoading = false;
        authListeners.forEach((listener) => listener.setLoading(false));
        return;
      }

      // Si une session existe, récupérer les données utilisateur depuis la table users
      const { data: existingUser, error: fetchError } = await supabase
        .from('users')
        .select('id, email, name, role')
        .eq('id', session.user.id)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        // PGRST116 signifie "aucune ligne trouvée", ce qui est attendu si l'utilisateur n'existe pas encore
        console.error('Erreur lors de la récupération des données utilisateur depuis la table users :', fetchError);
        throw fetchError;
      }

      if (!existingUser) {
        // Si l'utilisateur n'existe pas dans la table users, créer une entrée
        console.log('Utilisateur non trouvé dans la table users, création d\'une nouvelle entrée...');
        const { error: insertError } = await supabase
          .from('users')
          .insert({
            id: session.user.id,
            email: session.user.email,
            name: session.user.email.split('@')[0], // Nom par défaut basé sur l'email
            role: 'user', // Rôle par défaut, à ajuster si nécessaire
          });

        if (insertError) {
          console.error('Erreur lors de la création de l\'utilisateur dans la table users :', insertError);
          throw insertError;
        }

        // Récupérer les données nouvellement insérées
        const { data: newUser, error: newUserError } = await supabase
          .from('users')
          .select('id, email, name, role')
          .eq('id', session.user.id)
          .single();

        if (newUserError) {
          console.error('Erreur lors de la récupération des données de l\'utilisateur nouvellement créé :', newUserError);
          throw newUserError;
        }

        globalUser = newUser;
        authListeners.forEach((listener) => listener.setUser(newUser));
        console.log('Nouvel utilisateur créé et données récupérées :', newUser);
      } else {
        globalUser = existingUser;
        authListeners.forEach((listener) => listener.setUser(existingUser));
        console.log('Données utilisateur récupérées depuis la table users :', existingUser);
      }
    } catch (error) {
      console.error('Erreur lors de la récupération de l\'utilisateur:', error);
      globalUser = null;
      authListeners.forEach((listener) => listener.setUser(null));
    } finally {
      globalLoading = false;
      authListeners.forEach((listener) => listener.setLoading(false));
    }
  };

  useEffect(() => {
    // Ajouter le listener local pour les mises à jour globales
    authListeners.push({ setUser, setLoading });

    // Si aucun écouteur global n'est actif, en créer un
    if (!globalAuthListener) {
      // Vérifier la session initiale
      const checkSession = async () => {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
          console.error('Erreur lors de la récupération de la session:', sessionError);
          globalUser = null;
          globalLoading = false;
          authListeners.forEach((listener) => {
            listener.setUser(null);
            listener.setLoading(false);
          });
          return;
        }

        await fetchUser(session);
      };

      checkSession();

      // Créer un écouteur global pour les changements d'authentification
      globalAuthListener = supabase.auth.onAuthStateChange((event, session) => {
        console.log('onAuthStateChange:', event, 'Session:', session);
        if (event === 'SIGNED_IN' && session?.user) {
          fetchUser(session);
        } else if (event === 'SIGNED_OUT' || !session) {
          globalUser = null;
          globalLoading = false;
          authListeners.forEach((listener) => {
            listener.setUser(null);
            listener.setLoading(false);
          });
        }
      });
    }

    // Nettoyage lors du démontage du composant
    return () => {
      authListeners = authListeners.filter((listener) => listener.setUser !== setUser && listener.setLoading !== setLoading);
      if (authListeners.length === 0 && globalAuthListener) {
        globalAuthListener.subscription.unsubscribe();
        globalAuthListener = null;
      }
    };
  }, []);

  const signOut = async () => {
    try {
      setLoading(true);

      // Nettoyer l'onglet actif AVANT la déconnexion
      if (Platform.OS === 'web') {
        localStorage.removeItem('activeTab');
      } else {
        await AsyncStorage.removeItem('activeTab');
      }

      // Déconnecter l'utilisateur de Supabase
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      // Immédiatement rediriger vers la page de connexion
      router.replace('/(auth)/sign-in');

      // Mettre à jour l'état local
      globalUser = null;
      authListeners.forEach((listener) => listener.setUser(null));
    } catch (error) {
      console.error('Erreur lors de la déconnexion:', error);
    } finally {
      globalLoading = false;
      authListeners.forEach((listener) => listener.setLoading(false));
    }
  };

  return { user, loading, signOut };
};