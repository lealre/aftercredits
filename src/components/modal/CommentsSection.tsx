import { useState, useCallback, useEffect, useMemo } from 'react';
import { Comment } from '@/types/movie';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { MessageCircle, Edit3, Trash, X } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getGroupId, getUserId } from '@/services/authService';
import { fetchComments, createComment, updateComment, deleteComment, deleteCommentSeason } from '@/services/backendService';

interface CommentsSectionProps {
  movieImdbId: string;
  isOpen: boolean;
  isTVSeries: boolean;
  selectedSeason: string;
  getUserNameById: (userId: string) => string;
}

export const CommentsSection = ({
  movieImdbId,
  isOpen,
  isTVSeries,
  selectedSeason,
  getUserNameById,
}: CommentsSectionProps) => {
  const { toast } = useToast();
  const currentUserId = getUserId();

  const [allComments, setAllComments] = useState<Comment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentText, setEditingCommentText] = useState('');
  const [savingComment, setSavingComment] = useState(false);
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);
  const [showDeleteCommentModal, setShowDeleteCommentModal] = useState(false);
  const [commentToDelete, setCommentToDelete] = useState<string | null>(null);
  const [newCommentText, setNewCommentText] = useState('');
  const [addingComment, setAddingComment] = useState(false);
  const [showAddCommentForm, setShowAddCommentForm] = useState(false);

  const loadComments = useCallback(async () => {
    setLoadingComments(true);
    try {
      const groupId = getGroupId();
      if (!groupId) {
        setAllComments([]);
        setLoadingComments(false);
        return;
      }
      const loadedComments = await fetchComments(groupId, movieImdbId);
      setAllComments(Array.isArray(loadedComments) ? loadedComments : []);
    } catch (error) {
      console.error('Error loading comments:', error);
      setAllComments([]);
    } finally {
      setLoadingComments(false);
    }
  }, [movieImdbId]);

  // Filter comments based on selected season
  const comments = useMemo(() => {
    if (isTVSeries && selectedSeason) {
      return allComments
        .filter(comment => comment.seasonsComments && comment.seasonsComments[selectedSeason] !== undefined)
        .map(comment => ({
          ...comment,
          comment: comment.seasonsComments?.[selectedSeason]?.comment || comment.comment || '',
        }));
    } else {
      return allComments
        .filter(comment => comment.comment !== undefined && comment.comment !== null)
        .map(comment => ({
          ...comment,
          comment: comment.comment || '',
        }));
    }
  }, [allComments, isTVSeries, selectedSeason]);

  // Load comments when modal opens
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => loadComments(), 0);
      return () => clearTimeout(timer);
    } else {
      setAllComments([]);
      setEditingCommentId(null);
      setEditingCommentText('');
      setNewCommentText('');
      setShowAddCommentForm(false);
    }
  }, [isOpen, loadComments]);

  // Reset comment editing state when season changes
  useEffect(() => {
    if (!isOpen || !isTVSeries || !selectedSeason) return;
    setNewCommentText('');
    setShowAddCommentForm(false);
    setEditingCommentId(null);
    setEditingCommentText('');
  }, [isOpen, isTVSeries, selectedSeason]);

  const formatDate = useCallback((dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInHours = diffInMs / (1000 * 60 * 60);
    const diffInDays = diffInMs / (1000 * 60 * 60 * 24);

    if (diffInHours < 1) {
      const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
      return diffInMinutes <= 1 ? 'just now' : `${diffInMinutes}m ago`;
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h ago`;
    } else if (diffInDays < 7) {
      return `${Math.floor(diffInDays)}d ago`;
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
    }
  }, []);

  const handleEditComment = (comment: Comment) => {
    setEditingCommentId(comment.id);
    const commentText = isTVSeries && selectedSeason && comment.seasonsComments
      ? comment.seasonsComments[selectedSeason]?.comment || ''
      : comment.comment || '';
    setEditingCommentText(commentText);
  };

  const handleCancelEditComment = () => {
    setEditingCommentId(null);
    setEditingCommentText('');
  };

  const handleSaveEditComment = async (commentId: string) => {
    const trimmedComment = editingCommentText.trim();
    if (!trimmedComment) {
      toast({ title: "Error", description: "Comment cannot be empty or contain only spaces.", variant: "destructive" });
      return;
    }
    if (isTVSeries && !selectedSeason) {
      toast({ title: "Season required", description: "Please select a season before updating the comment.", variant: "destructive" });
      return;
    }
    setSavingComment(true);
    try {
      const groupId = getGroupId();
      if (!groupId) { setSavingComment(false); return; }
      const season = isTVSeries && selectedSeason ? parseInt(selectedSeason, 10) : undefined;
      await updateComment(groupId, movieImdbId, commentId, trimmedComment, season);
      await loadComments();
      setEditingCommentId(null);
      setEditingCommentText('');
      toast({ title: "Comment updated!", description: "Your comment has been updated." });
    } catch (error) {
      console.error('Error updating comment:', error);
      toast({ title: "Error", description: "Failed to update comment. Please try again.", variant: "destructive" });
    } finally {
      setSavingComment(false);
    }
  };

  const handleAddComment = async () => {
    const trimmedComment = newCommentText.trim();
    if (!trimmedComment) {
      toast({ title: "Error", description: "Comment cannot be empty or contain only spaces.", variant: "destructive" });
      return;
    }
    if (isTVSeries && !selectedSeason) {
      toast({ title: "Season required", description: "Please select a season before adding a comment.", variant: "destructive" });
      return;
    }
    const groupId = getGroupId();
    if (!groupId) { return; }
    setAddingComment(true);
    try {
      const season = isTVSeries && selectedSeason ? parseInt(selectedSeason, 10) : undefined;
      await createComment(groupId, movieImdbId, trimmedComment, season);
      await loadComments();
      setNewCommentText('');
      setShowAddCommentForm(false);
      toast({ title: "Comment added!", description: "Your comment has been added." });
    } catch (error) {
      console.error('Error adding comment:', error);
      toast({ title: "Error", description: "Failed to add comment. Please try again.", variant: "destructive" });
    } finally {
      setAddingComment(false);
    }
  };

  const handleDeleteCommentConfirm = async () => {
    if (!commentToDelete) return;
    const commentId = commentToDelete;
    setShowDeleteCommentModal(false);
    setDeletingCommentId(commentId);
    try {
      const groupId = getGroupId();
      if (!groupId) { setDeletingCommentId(null); setCommentToDelete(null); return; }
      if (isTVSeries) {
        if (!selectedSeason) { setDeletingCommentId(null); setCommentToDelete(null); return; }
        await deleteCommentSeason(groupId, movieImdbId, commentId, parseInt(selectedSeason, 10));
      } else {
        await deleteComment(groupId, movieImdbId, commentId);
      }
      await loadComments();
      toast({ title: "Comment deleted", description: "The comment has been removed." });
    } catch (error) {
      console.error('Error deleting comment:', error);
      toast({ title: "Error", description: "Failed to delete comment. Please try again.", variant: "destructive" });
    } finally {
      setDeletingCommentId(null);
      setCommentToDelete(null);
    }
  };

  return (
    <>
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-movie-blue flex items-center gap-2">
          <MessageCircle className="w-4 h-4" />
          Comments ({comments.length})
        </h3>
        <div className="space-y-3 overflow-x-hidden max-h-[300px] overflow-y-auto">
          {loadingComments ? (
            <div className="text-center text-xs text-muted-foreground py-2">Loading comments...</div>
          ) : comments.length === 0 ? (
            <div className="text-center text-xs text-muted-foreground py-2">No comments yet. Be the first to comment!</div>
          ) : (
            comments.map((comment) => {
              const isEditing = editingCommentId === comment.id;
              const isUpdated = comment.updatedAt !== comment.createdAt;
              return (
                <div key={comment.id} className="bg-movie-surface border border-border rounded-lg p-3 space-y-2 overflow-x-hidden">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-foreground">{getUserNameById(comment.userId)}</span>
                        <span className="text-xs text-muted-foreground">•</span>
                        <span className="text-xs text-muted-foreground">{formatDate(comment.createdAt)}</span>
                        {isUpdated && (
                          <>
                            <span className="text-xs text-muted-foreground">•</span>
                            <span className="text-xs text-muted-foreground italic">edited {formatDate(comment.updatedAt)}</span>
                          </>
                        )}
                      </div>
                    </div>
                    {!isEditing && currentUserId && comment.userId === currentUserId && (
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" onClick={() => handleEditComment(comment)} className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground">
                          <Edit3 className="w-3 h-3" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => { setCommentToDelete(comment.id); setShowDeleteCommentModal(true); }} disabled={deletingCommentId === comment.id} className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive">
                          {deletingCommentId === comment.id ? <X className="w-3 h-3 animate-spin" /> : <Trash className="w-3 h-3" />}
                        </Button>
                      </div>
                    )}
                  </div>
                  {isEditing ? (
                    <div className="space-y-2">
                      <Textarea value={editingCommentText} onChange={(e) => setEditingCommentText(e.target.value)} placeholder="Write your comment..." className="bg-background border-border resize-none min-h-[70px] text-sm" rows={3} />
                      <div className="flex gap-2 justify-end">
                        <Button variant="outline" size="sm" onClick={handleCancelEditComment} disabled={savingComment} className="h-8 text-xs">Cancel</Button>
                        <Button size="sm" onClick={() => handleSaveEditComment(comment.id)} disabled={savingComment || !editingCommentText.trim()} className="h-8 text-xs bg-movie-blue text-movie-blue-foreground hover:bg-movie-blue-light">{savingComment ? 'Saving...' : 'Save'}</Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-foreground whitespace-pre-wrap break-words max-w-full">{comment.comment}</p>
                  )}
                </div>
              );
            })
          )}
        </div>

        {!showAddCommentForm && (
          <Button variant="outline" onClick={() => setShowAddCommentForm(true)} className="w-full border-movie-blue/30 text-movie-blue hover:bg-movie-blue/10">
            <MessageCircle className="w-4 h-4 mr-2" />
            Add Comment
          </Button>
        )}

        {showAddCommentForm && (
          <div className="space-y-2 pt-2 border-t border-border">
            <Textarea value={newCommentText} onChange={(e) => setNewCommentText(e.target.value)} placeholder="Write your comment..." className="bg-background border-border resize-none min-h-[70px] text-sm" rows={3} />
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => { setShowAddCommentForm(false); setNewCommentText(''); }} disabled={addingComment} className="flex-1 h-8 text-xs">Cancel</Button>
              <Button onClick={handleAddComment} disabled={addingComment || !newCommentText.trim()} className="flex-1 h-8 text-xs bg-movie-blue text-movie-blue-foreground hover:bg-movie-blue-light">{addingComment ? 'Adding...' : 'Add Comment'}</Button>
            </div>
          </div>
        )}
      </div>

      <AlertDialog open={showDeleteCommentModal} onOpenChange={() => { setShowDeleteCommentModal(false); setCommentToDelete(null); }}>
        <AlertDialogContent className="bg-movie-surface border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">Delete Comment</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              {isTVSeries && selectedSeason
                ? `Are you sure you want to delete the comment for Season ${selectedSeason}? (Other seasons will be kept)`
                : 'Are you sure you want to delete this comment? This action cannot be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setShowDeleteCommentModal(false); setCommentToDelete(null); }} disabled={deletingCommentId !== null} className="bg-movie-surface border-border hover:bg-movie-surface/80">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteCommentConfirm} disabled={deletingCommentId !== null} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deletingCommentId !== null ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-destructive-foreground/30 border-t-destructive-foreground rounded-full animate-spin" />
                  Deleting...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Trash2 className="w-4 h-4" />
                  Delete Comment
                </div>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
