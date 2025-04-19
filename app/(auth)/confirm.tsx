import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Pressable, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';

export default function ConfirmScreen() {
  const router = useRouter();
  const { access_token: queryToken, type } = useLocalSearchParams(); // Récupérer les query parameters
  const [message, setMessage] = useState('Vérification en cours...');
  const [error, setError] = useState(null);

  // Récupérer le token depuis le fragment d'URL (si présent)
  const getTokenFromHash = () => {
    if (Platform.OS === 'web') {
      const hash = window.location.hash; // Récupère le fragment (ex: #access_token=...)
      if (hash) {
        const params = new URLSearchParams(hash.replace('#', '')); // Convertit le fragment en paramètres
        return params.get('access_token');
      }
    }
    return null;
  };

  const token = queryToken || getTokenFromHash(); // Utilise le token des query params ou du fragment

  useEffect(() => {
    const confirmEmail = async () => {
      if (!token) {
        setError('Aucun token de confirmation fourni.');
        setMessage('Erreur lors de la confirmation.');
        return;
      }

      try {
        // Vérifier le token de confirmation avec Supabase
        const { error } = await supabase.auth.verifyOtp({
          token: token,
          type: 'signup', // Type de confirmation
        });

        if (error) {
          throw error;
        }

        setMessage('Email confirmé avec succès ! Vous allez être redirigé vers la page de connexion.');
        setTimeout(() => {
          router.replace('/(auth)/sign-in');
        }, 3000);
      } catch (err) {
        setError(err.message);
        setMessage('Erreur lors de la confirmation de l’email.');
      }
    };

    confirmEmail();
  }, [token, router]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Confirmation de l’email</Text>
      <Text style={styles.message}>{message}</Text>
      {error && <Text style={styles.error}>{error}</Text>}
      {!error && message === 'Vérification en cours...' && (
        <ActivityIndicator size="large" color="#1a73e8" />
      )}
      {message !== 'Vérification en cours...' && (
        <Pressable
          style={styles.button}
          onPress={() => router.replace('/(auth)/sign-in')}
        >
          <Text style={styles.buttonText}>Aller à la connexion</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 20,
  },
  message: {
    fontSize: 18,
    color: '#1a1a1a',
    textAlign: 'center',
    marginBottom: 20,
  },
  error: {
    fontSize: 16,
    color: '#d32f2f',
    textAlign: 'center',
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#1a73e8',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});