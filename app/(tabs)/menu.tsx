import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { LogOut, Settings, User, CircleHelp as HelpCircle } from 'lucide-react-native';
import { useAuth } from '@/hooks/useAuth';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function MenuScreen() {
  const { user, signOut } = useAuth();
  const [userName, setUserName] = useState<string | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);

  // Récupérer le nom de l'utilisateur depuis la table users
  useEffect(() => {
    const fetchUserName = async () => {
      if (user) {
        const { data, error } = await supabase
          .from('users')
          .select('name')
          .eq('id', user.id)
          .single();

        if (error) {
          console.error('Erreur lors de la récupération du nom:', error);
        } else {
          setUserName(data?.name || null);
        }
      }
    };

    fetchUserName();
  }, [user]);

  const handleSignOut = async () => {
    if (isSigningOut) return; // Éviter les doubles clics
    
    console.log('Début de la déconnexion...');
    setIsSigningOut(true);
    
    try {
      // Nettoyer l'onglet actif d'abord
      if (Platform.OS === 'web') {
        localStorage.removeItem('activeTab');
      } else {
        await AsyncStorage.removeItem('activeTab');
      }
      
      // Utiliser la fonction signOut du hook useAuth qui gère déjà la redirection
      await signOut();
      console.log('Déconnexion réussie');
      
      // Ne pas rediriger ici, la redirection est gérée dans useAuth.ts
      // La redirection multiple est un des problèmes de routage
    } catch (error) {
      console.error('Erreur lors de la déconnexion :', error.message);
    } finally {
      setIsSigningOut(false);
    }
  };

  const handleNavigateToProfile = () => {
    router.push('profile');
  };

  const handleNavigateToSettings = () => {
    router.push('settings');
  };

  const handleNavigateToHelp = () => {
    router.push('help');
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Menu</Text>
      </View>
      <View style={styles.content}>
        <View style={styles.profileCard}>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{userName || 'Utilisateur anonyme'}</Text>
            <Text style={styles.profileRole}>Membre</Text>
            <Text style={styles.profileEmail}>{user?.email || 'Utilisateur non connecté'}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <TouchableOpacity style={styles.menuItem} onPress={handleNavigateToProfile}>
            <User size={24} color="#1a1a1a" />
            <Text style={styles.menuText}>Profil</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={handleNavigateToSettings}>
            <Settings size={24} color="#1a1a1a" />
            <Text style={styles.menuText}>Paramètres</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={handleNavigateToHelp}>
            <HelpCircle size={24} color="#1a1a1a" />
            <Text style={styles.menuText}>Aide</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.menuItem, styles.logoutButton]} 
            onPress={handleSignOut}
            disabled={isSigningOut}
          >
            <LogOut size={24} color="#ff6b6b" />
            <Text style={[styles.menuText, styles.logoutText]}>
              {isSigningOut ? 'Déconnexion...' : 'Déconnexion'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  content: {
    padding: 20,
  },
  profileCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    ...(Platform.OS === 'web'
      ? {
          boxShadow: '0px 2px 3px rgba(0, 0, 0, 0.1)',
        }
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 3,
          elevation: 3,
        }),
  },
  profileInfo: {
    marginLeft: 15,
  },
  profileName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  profileRole: {
    fontSize: 16,
    color: '#666',
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 14,
    color: '#666',
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    ...(Platform.OS === 'web'
      ? {
          boxShadow: '0px 2px 3px rgba(0, 0, 0, 0.1)',
        }
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 3,
          elevation: 3,
        }),
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  menuText: {
    fontSize: 16,
    marginLeft: 15,
    color: '#1a1a1a',
  },
  logoutButton: {
    borderBottomWidth: 0,
  },
  logoutText: {
    color: '#ff6b6b',
  },
});