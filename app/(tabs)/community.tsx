import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet, Dimensions } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Plus } from 'lucide-react-native';
import { MaterialIcons } from '@expo/vector-icons';

export default function CommunityScreen() {
  const { user } = useAuth();
  const [categories, setCategories] = useState([
    { id: 'events', name: 'Événements et activités', icon: 'event' },
    { id: 'reports', name: 'Signalements et améliorations', icon: 'warning' },
    { id: 'daily', name: 'Vie quotidienne', icon: 'handshake' },
    { id: 'ads', name: 'Petites annonces', icon: 'shopping-bag' },
    { id: 'ideas', name: 'Idées et suggestions', icon: 'lightbulb-outline' },
  ]);

  useEffect(() => {
    const fetchPostCounts = async () => {
      const updatedCategories = [...categories];
      for (let category of updatedCategories) {
        const { count, error } = await supabase
          .from('posts')
          .select('*', { count: 'exact', head: true })
          .eq('category', category.id)
          .is('deleted_at', null);
        if (!error) {
          category.postCount = count || 0;
        }
      }
      setCategories(updatedCategories);
    };

    fetchPostCounts();

    const subscription = supabase
      .channel('posts_channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, () => {
        fetchPostCounts();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const renderCategory = ({ item }) => (
    <TouchableOpacity
      style={styles.categorySquare}
      onPress={() => router.push(`/communities/category/${item.id}`)}
    >
      <MaterialIcons name={item.icon} size={64} color="#2563eb" style={styles.categoryIcon} />
      <Text style={styles.categoryName}>{item.name}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Communauté</Text>
      <View style={styles.welcomeCard}>
        <Text style={styles.welcomeTitle}>Bienvenue sur le forum</Text>
        <Text style={styles.welcomeText}>
          Cet espace est dédié aux échanges entre habitants du quartier.
        </Text>
      </View>
      <FlatList
        data={categories}
        renderItem={renderCategory}
        keyExtractor={(item) => item.id}
        numColumns={2}
        contentContainerStyle={styles.categoryGrid}
      />
      {user && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => router.push('/communities/new-post')}
        >
          <Plus color="#fff" size={24} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const { width } = Dimensions.get('window');
const squareSize = (width - 48) / 2;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  welcomeCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  welcomeTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  welcomeText: {
    fontSize: 14,
    color: '#6b7280',
  },
  categoryGrid: {
    paddingBottom: 80,
  },
  categorySquare: {
    width: squareSize,
    height: squareSize + 20,
    backgroundColor: '#fff',
    borderRadius: 10,
    margin: 8,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  categoryIcon: {
    marginBottom: 12,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
    color: '#374151',
  },
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: '#2563eb',
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
  },
});