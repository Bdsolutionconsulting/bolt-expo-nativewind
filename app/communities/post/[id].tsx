import { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, Image } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { ChevronLeft } from 'lucide-react-native';

export default function PostScreen() {
  const { id } = useLocalSearchParams();
  const { user } = useAuth();
  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchPost = async () => {
      const { data, error } = await supabase
        .from('posts')
        .select('id, title, content, photo_url, created_at, user_id, users (name)')
        .eq('id', id)
        .is('deleted_at', null)
        .single();

      if (error) {
        console.error('Erreur lors du chargement du post:', error);
        return;
      }

      setPost({
        ...data,
        author: data.users?.name || 'Anonyme',
      });
    };

    const fetchComments = async () => {
      const { data, error } = await supabase
        .from('comments')
        .select('id, content, created_at, user_id, users (name)')
        .eq('post_id', id)
        .is('deleted_at', null)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Erreur lors du chargement des commentaires:', error);
        return;
      }

      setComments(
        data.map((comment) => ({
          ...comment,
          author: comment.users?.name || 'Anonyme',
        }))
      );
    };

    fetchPost();
    fetchComments();

    const commentSubscription = supabase
      .channel('comments_channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comments', filter: `post_id=eq.${id}` }, () => {
        fetchComments();
      })
      .subscribe();

    return () => {
      commentSubscription.unsubscribe();
    };
  }, [id]);

  const handleAddComment = async () => {
    if (!newComment) {
      setError('Le commentaire ne peut pas être vide.');
      return;
    }

    setLoading(true);
    setError(null);

    const { error } = await supabase.from('comments').insert({
      post_id: id,
      user_id: user.id,
      content: newComment,
    });

    if (error) {
      setError('Erreur lors de l’ajout du commentaire : ' + error.message);
    } else {
      setNewComment('');
    }

    setLoading(false);
  };

  const handleDeletePost = async () => {
    if (post.photo_url) {
      const filePath = post.photo_url.split('/').slice(-2).join('/');
      await supabase.storage.from('post-photos').remove([filePath]);
    }

    const { error } = await supabase.rpc('delete_post', { p_post_id: id });

    if (error) {
      console.error('Erreur lors de la suppression du post:', error);
    } else {
      router.back();
    }
  };

  const handleDeleteComment = async (commentId) => {
    const { error } = await supabase.rpc('delete_comment', { p_comment_id: commentId });

    if (error) {
      console.error('Erreur lors de la suppression du commentaire:', error);
    }
  };

  const renderComment = ({ item }) => (
    <View style={styles.commentCard}>
      <View style={styles.commentContent}>
        <Text style={styles.commentAuthor}>{item.author}</Text>
        <Text style={styles.commentDate}>
          {new Date(item.created_at).toLocaleString('fr-FR', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </Text>
        <Text style={styles.commentContentText}>{item.content}</Text>
      </View>
      {(user?.role === 'admin' || user?.role === 'super_admin' || user?.id === item.user_id) && (
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => handleDeleteComment(item.id)}
        >
          <Text style={styles.deleteButtonText}>Supprimer</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  if (!post) {
    return (
      <View style={styles.container}>
        <Text style={styles.emptyText}>Chargement...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft color="#374151" size={24} />
        </TouchableOpacity>
        <Text style={styles.header}>{post.title}</Text>
        {(user?.role === 'admin' || user?.role === 'super_admin' || user?.id === post.user_id) && (
          <TouchableOpacity style={styles.deleteButton} onPress={handleDeletePost}>
            <Text style={styles.deleteButtonText}>Supprimer</Text>
          </TouchableOpacity>
        )}
      </View>
      <Text style={styles.postMeta}>
        {post.author} – {new Date(post.created_at).toLocaleString('fr-FR', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })}
      </Text>
      {post.photo_url && (
        <Image source={{ uri: post.photo_url }} style={styles.postPhoto} />
      )}
      <Text style={styles.postContent}>{post.content}</Text>
      <Text style={styles.commentsHeader}>Commentaires</Text>
      {comments.length === 0 ? (
        <Text style={styles.emptyText}>Aucun commentaire pour le moment.</Text>
      ) : (
        <FlatList
          data={comments}
          renderItem={renderComment}
          keyExtractor={(item) => item.id}
          style={styles.commentList}
        />
      )}
      {user && (
        <View style={styles.commentForm}>
          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
          <TextInput
            style={styles.commentInput}
            placeholder="Ajoutez un commentaire..."
            value={newComment}
            onChangeText={setNewComment}
            multiline
          />
          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleAddComment}
            disabled={loading}
          >
            <Text style={styles.buttonText}>{loading ? 'Envoi...' : 'Envoyer'}</Text>
          </TouchableOpacity>
        </View>
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
    marginBottom: 8,
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
  postMeta: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 12,
  },
  postPhoto: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginBottom: 12,
  },
  postContent: {
    fontSize: 16,
    color: '#374151',
    marginBottom: 20,
  },
  commentsHeader: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  commentList: {
    marginBottom: 16,
  },
  commentCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 2,
  },
  commentContent: {
    flex: 1,
  },
  commentAuthor: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#374151',
  },
  commentDate: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  commentContentText: {
    fontSize: 14,
    color: '#374151',
  },
  deleteButton: {
    backgroundColor: '#dc2626',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  commentForm: {
    marginTop: 16,
  },
  errorContainer: {
    backgroundColor: '#fee2e2',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  errorText: {
    color: '#dc2626',
    fontSize: 14,
    textAlign: 'center',
  },
  commentInput: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    fontSize: 16,
    height: 80,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  button: {
    backgroundColor: '#2563eb',
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonDisabled: {
    backgroundColor: '#93c5fd',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 20,
  },
});