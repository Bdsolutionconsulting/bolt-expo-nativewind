import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet, Image } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { ChevronLeft } from 'lucide-react-native';

export default function CategoryScreen() {
  const { user } = useAuth();
  const { id } = useLocalSearchParams();
  const [posts, setPosts] = useState([]);
  const [categoryName, setCategoryName] = useState('');
  const [description, setDescription] = useState({ title: '', subtitle: '' });

  useEffect(() => {
    const categoryNames = {
      events: 'Événements et activités',
      reports: 'Signalements et améliorations',
      daily: 'Vie quotidienne',
      ads: 'Petites annonces',
      ideas: 'Idées et suggestions',
    };

    const categoryDescriptions = {
      events: {
        title: 'Pour discuter des événements locaux',
        subtitle: 'Par exemple une fête dans la cité\nou une conférence (compléter la page "Événements")',
      },
      reports: {
        title: 'Un espace pour échanger sur les dysfonctionnements signalés',
        subtitle:
          'Comme un lampadaire cassé, des ordures ou des voitures abandonnées (compléter la page "Signalements").\nLes habitants peuvent donner leur avis ou proposer des solutions.',
      },
      daily: {
        title: 'Pour les sujets liés au quotidien dans le quartier',
        subtitle:
          'Comme des recommandations (boulangerie, médecin, etc.), des questions sur les services locaux,\nou des partages d’astuces (par exemple, "Où trouver un bon plombier ?").',
      },
      ads: {
        title: 'Un espace pour des échanges entre habitants',
        subtitle:
          'Comme des ventes d’objets, des demandes de covoiturage,\nou des offres de services (baby-sitting, gardiens, etc.).',
      },
      ideas: {
        title: 'Pour proposer des idées d’amélioration du quartier',
        subtitle: 'Comme l’installation de bancs\nou l’organisation d’une journée de nettoyage.',
      },
    };

    setCategoryName(categoryNames[id] || 'Catégorie inconnue');
    setDescription(categoryDescriptions[id] || { title: '', subtitle: '' });

    const fetchPosts = async () => {
      const { data: postsData, error: postsError } = await supabase
        .from('posts')
        .select('id, title, content, photo_url, created_at, user_id, users (name)')
        .eq('category', id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (postsError) {
        console.error('Erreur lors du chargement des posts:', postsError);
        return;
      }

      const postsWithComments = await Promise.all(
        postsData.map(async (post) => {
          const { count, error: commentError } = await supabase
            .from('comments')
            .select('*', { count: 'exact', head: true })
            .eq('post_id', post.id)
            .is('deleted_at', null);

          return {
            ...post,
            commentCount: count || 0,
            author: post.users?.name || 'Anonyme',
          };
        })
      );

      setPosts(postsWithComments);
    };

    fetchPosts();

    const postSubscription = supabase
      .channel('posts_channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts', filter: `category=eq.${id}` }, () => {
        fetchPosts();
      })
      .subscribe();

    const commentSubscription = supabase
      .channel('comments_channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, () => {
        fetchPosts();
      })
      .subscribe();

    return () => {
      postSubscription.unsubscribe();
      commentSubscription.unsubscribe();
    };
  }, [id]);

  const handleDeletePost = async (postId, photoUrl) => {
    if (photoUrl) {
      const filePath = photoUrl.split('/').slice(-2).join('/');
      await supabase.storage.from('post-photos').remove([filePath]);
    }

    const { error } = await supabase.rpc('delete_post', { p_post_id: postId });

    if (error) {
      console.error('Erreur lors de la suppression du post:', error);
    }
  };

  const renderPost = ({ item }) => (
    <TouchableOpacity
      style={styles.postCard}
      onPress={() => router.push(`/communities/post/${item.id}`)}
    >
      <View style={styles.postContent}>
        <Text style={styles.postTitle}>{item.title}</Text>
        <Text style={styles.postMeta}>
          {item.author} – {new Date(item.created_at).toLocaleString('fr-FR', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </Text>
        {item.photo_url && (
          <Image source={{ uri: item.photo_url }} style={styles.postPhoto} />
        )}
        <Text style={styles.postExcerpt}>
          {item.content.length > 50 ? `${item.content.substring(0, 50)}...` : item.content}
        </Text>
        <Text style={styles.commentCount}>{item.commentCount} commentaire{item.commentCount !== 1 ? 's' : ''}</Text>
      </View>
      {(user?.role === 'admin' || user?.role === 'super_admin' || user?.id === item.user_id) && (
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => handleDeletePost(item.id, item.photo_url)}
        >
          <Text style={styles.deleteButtonText}>Supprimer</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft color="#374151" size={24} />
        </TouchableOpacity>
        <Text style={styles.header}>{categoryName}</Text>
      </View>
      <View style={styles.descriptionCard}>
        <Text style={styles.descriptionTitle}>{description.title}</Text>
        <Text style={styles.descriptionSubtitle}>{description.subtitle}</Text>
      </View>
      {posts.length === 0 ? (
        <Text style={styles.emptyText}>Aucun post pour le moment.</Text>
      ) : (
        <FlatList
          data={posts}
          renderItem={renderPost}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.postList}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    flex: 1,
  },
  descriptionCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  descriptionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  descriptionSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20, // Pour un meilleur espacement des lignes
  },
  postList: {
    paddingBottom: 16,
  },
  postCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  postContent: {
    flex: 1,
  },
  postTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  postMeta: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 8,
  },
  postPhoto: {
    width: '100%',
    height: 150,
    borderRadius: 8,
    marginBottom: 8,
  },
  postExcerpt: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 8,
  },
  commentCount: {
    fontSize: 12,
    color: '#2563eb',
  },
  deleteButton: {
    backgroundColor: '#dc2626',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    justifyContent: 'center',
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 20,
  },
});