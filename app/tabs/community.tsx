import * as ImagePicker from "expo-image-picker";
import { StatusBar } from "expo-status-bar";
import {
    ChevronDown, ChevronUp, CornerDownRight,
    Heart,
    Image as ImageIcon,
    MessageSquare, Plus, Search, Send, Trash2,
    Users, X,
} from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    KeyboardAvoidingView,
    Modal,
    Platform,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { supabase } from "../../lib/supabase";

// ─── Types ────────────────────────────────────
interface PostMedia {
    id: string;
    url: string;
    media_type: "image" | "video";
}

interface Post {
    id: string;
    user_id: string;
    author_name: string;
    author_initials: string;
    title: string;
    content: string;
    category: string;
    likes_count: number;
    comments_count: number;
    created_at: string;
    isLiked?: boolean;
    media?: PostMedia[];
}

interface Comment {
    id: string;
    user_id: string;
    post_id: string;
    author_name: string;
    author_initials: string;
    content: string;
    likes_count: number;
    reply_count: number;
    parent_comment_id: string | null;
    created_at: string;
    isLiked?: boolean;
    replies?: Comment[];
    showReplies?: boolean;
}

// ─── Constants ────────────────────────────────
const CATEGORIES = ["All", "Achievement", "Nutrition", "Motivation", "Discussion", "Questions"];
const POST_CATEGORIES = CATEGORIES.slice(1);
const TRENDING = ["#WeightLoss", "#MealPrep", "#RunningTips", "#HomeWorkout", "#Motivation"];

const categoryConfig: Record<string, { color: string; tint: string; border: string }> = {
    Achievement: { color: "#f59e0b", tint: "rgba(245,158,11,0.10)", border: "rgba(245,158,11,0.22)" },
    Nutrition: { color: "#22c55e", tint: "rgba(34,197,94,0.10)", border: "rgba(34,197,94,0.22)" },
    Motivation: { color: "#a855f7", tint: "rgba(168,85,247,0.10)", border: "rgba(168,85,247,0.22)" },
    Discussion: { color: "#3b82f6", tint: "rgba(59,130,246,0.10)", border: "rgba(59,130,246,0.22)" },
    Questions: { color: "#f97316", tint: "rgba(249,115,22,0.10)", border: "rgba(249,115,22,0.22)" },
};
const fallbackConfig = { color: "#888", tint: "rgba(136,136,136,0.10)", border: "rgba(136,136,136,0.22)" };

function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
}

function getInitials(name: string): string {
    return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

// ─── Media Upload Helper ──────────────────────
async function uploadMedia(
    uri: string,
    userId: string,
    postId: string,
    mediaType: "image" | "video"
): Promise<{ url: string; storage_path: string } | null> {
    try {
        const ext = uri.split(".").pop() ?? "jpg";
        const fileName = `${postId}/${Date.now()}.${ext}`;
        const response = await fetch(uri);
        const blob = await response.blob();
        const arrayBuffer = await new Response(blob).arrayBuffer();

        const { error: uploadError } = await supabase.storage
            .from("post-media")
            .upload(fileName, arrayBuffer, {
                contentType: mediaType === "image" ? `image/${ext}` : `video/${ext}`,
                upsert: false,
            });

        if (uploadError) throw uploadError;

        const { data } = supabase.storage.from("post-media").getPublicUrl(fileName);
        return { url: data.publicUrl, storage_path: fileName };
    } catch (e) {
        console.error("Upload failed:", e);
        return null;
    }
}

// ─── Post Media Gallery ───────────────────────
function PostMediaGallery({ media }: { media: PostMedia[] }) {
    if (!media || media.length === 0) return null;
    const single = media.length === 1;

    return (
        <View style={mgStyles.container}>
            {media.map((m, idx) => (
                <View
                    key={m.id}
                    style={[
                        mgStyles.mediaItem,
                        single && mgStyles.singleMedia,
                        !single && media.length === 2 && mgStyles.halfMedia,
                        !single && media.length >= 3 && idx === 0 && mgStyles.thirdLargeMedia,
                        !single && media.length >= 3 && idx > 0 && mgStyles.thirdSmallMedia,
                    ]}
                >
                    <Image source={{ uri: m.url }} style={mgStyles.image} resizeMode="cover" />
                </View>
            ))}
        </View>
    );
}

const mgStyles = StyleSheet.create({
    container: { flexDirection: "row", flexWrap: "wrap", gap: 3, borderRadius: 10, overflow: "hidden", marginTop: 4 },
    mediaItem: { overflow: "hidden", borderRadius: 8 },
    singleMedia: { width: "100%", height: 200 },
    halfMedia: { width: "48.5%", height: 150 },
    thirdLargeMedia: { width: "60%", height: 180 },
    thirdSmallMedia: { width: "38%", height: 88 },
    image: { width: "100%", height: "100%" },
});

// ─── Comment Item ─────────────────────────────
function CommentItem({
    comment,
    currentUserId,
    onLike,
    onDelete,
    onReply,
    depth = 0,
}: {
    comment: Comment;
    currentUserId: string;
    onLike: (id: string, isLiked: boolean) => void;
    onDelete: (id: string) => void;
    onReply: (comment: Comment) => void;
    depth?: number;
}) {
    const isOwn = comment.user_id === currentUserId;
    const isReply = depth > 0;

    return (
        <View style={[cs.commentCard, isReply && cs.replyCard]}>
            {isReply && <View style={cs.replyConnector} />}
            <View style={cs.commentHeader}>
                <View style={[cs.commentAvatar, isReply && cs.replyAvatar]}>
                    <Text style={[cs.commentAvatarText, isReply && { fontSize: 10 }]}>
                        {comment.author_initials}
                    </Text>
                </View>
                <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                        <Text style={cs.commentAuthor}>{comment.author_name}</Text>
                        <Text style={cs.commentTime}>{timeAgo(comment.created_at)}</Text>
                    </View>
                    <Text style={cs.commentContent}>{comment.content}</Text>
                    <View style={cs.commentActions}>
                        <TouchableOpacity
                            style={cs.commentLikeBtn}
                            onPress={() => onLike(comment.id, comment.isLiked ?? false)}
                        >
                            <Heart
                                size={13}
                                color={comment.isLiked ? "#ef4444" : "#555"}
                                fill={comment.isLiked ? "#ef4444" : "transparent"}
                            />
                            <Text style={[cs.commentLikeCount, comment.isLiked && { color: "#ef4444" }]}>
                                {comment.likes_count}
                            </Text>
                        </TouchableOpacity>

                        {/* Reply button — only on top-level comments */}
                        {!isReply && (
                            <TouchableOpacity
                                style={cs.commentLikeBtn}
                                onPress={() => onReply(comment)}
                            >
                                <CornerDownRight size={13} color="#555" />
                                <Text style={cs.commentLikeCount}>Reply</Text>
                            </TouchableOpacity>
                        )}

                        {isOwn && (
                            <TouchableOpacity onPress={() => onDelete(comment.id)}>
                                <Trash2 size={13} color="#555" />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </View>
        </View>
    );
}

// ─── Comment Thread (top-level + replies) ─────
function CommentThread({
    comment,
    currentUserId,
    onLike,
    onDelete,
    onReply,
    onToggleReplies,
    loadingReplies,
}: {
    comment: Comment;
    currentUserId: string;
    onLike: (id: string, isLiked: boolean, parentId?: string) => void;
    onDelete: (id: string, parentId?: string) => void;
    onReply: (comment: Comment) => void;
    onToggleReplies: (comment: Comment) => void;
    loadingReplies: string | null;
}) {
    return (
        <View style={{ gap: 6 }}>
            <CommentItem
                comment={comment}
                currentUserId={currentUserId}
                onLike={onLike}
                onDelete={onDelete}
                onReply={onReply}
                depth={0}
            />

            {/* Show/hide replies toggle */}
            {comment.reply_count > 0 && (
                <TouchableOpacity
                    style={cs.toggleRepliesBtn}
                    onPress={() => onToggleReplies(comment)}
                >
                    {loadingReplies === comment.id ? (
                        <ActivityIndicator size="small" color="#22c55e" />
                    ) : (
                        <>
                            {comment.showReplies
                                ? <ChevronUp size={13} color="#22c55e" />
                                : <ChevronDown size={13} color="#22c55e" />}
                            <Text style={cs.toggleRepliesText}>
                                {comment.showReplies
                                    ? "Hide replies"
                                    : `${comment.reply_count} ${comment.reply_count === 1 ? "reply" : "replies"}`}
                            </Text>
                        </>
                    )}
                </TouchableOpacity>
            )}

            {/* Replies */}
            {comment.showReplies && comment.replies && comment.replies.length > 0 && (
                <View style={cs.repliesContainer}>
                    {comment.replies.map((reply) => (
                        <CommentItem
                            key={reply.id}
                            comment={reply}
                            currentUserId={currentUserId}
                            onLike={(id, isLiked) => onLike(id, isLiked, comment.id)}
                            onDelete={(id) => onDelete(id, comment.id)}
                            onReply={onReply}
                            depth={1}
                        />
                    ))}
                </View>
            )}
        </View>
    );
}

// ─── Post Comments Modal ──────────────────────
function CommentsModal({
    visible,
    post,
    currentUserId,
    onClose,
    onCommentCountChange,
}: {
    visible: boolean;
    post: Post | null;
    currentUserId: string;
    onClose: () => void;
    onCommentCountChange: (postId: string, delta: number) => void;
}) {
    const [comments, setComments] = useState<Comment[]>([]);
    const [loading, setLoading] = useState(true);
    const [newComment, setNewComment] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [replyingTo, setReplyingTo] = useState<Comment | null>(null);
    const [loadingReplies, setLoadingReplies] = useState<string | null>(null);
    const scrollRef = useRef<ScrollView>(null);
    const inputRef = useRef<TextInput>(null);

    useEffect(() => {
        if (visible && post) loadComments();
        if (!visible) {
            setComments([]);
            setReplyingTo(null);
            setNewComment("");
        }
    }, [visible, post]);

    const loadComments = async () => {
        if (!post) return;
        setLoading(true);

        const [commentsRes, likesRes] = await Promise.all([
            supabase
                .from("post_comments")
                .select("*")
                .eq("post_id", post.id)
                .is("parent_comment_id", null)  // only top-level
                .order("created_at", { ascending: true }),
            supabase
                .from("comment_likes")
                .select("comment_id")
                .eq("user_id", currentUserId),
        ]);

        const likedIds = new Set((likesRes.data ?? []).map((l) => l.comment_id));
        setComments(
            (commentsRes.data ?? []).map((c) => ({
                ...c,
                isLiked: likedIds.has(c.id),
                replies: [],
                showReplies: false,
            }))
        );
        setLoading(false);
    };

    const handleToggleReplies = async (comment: Comment) => {
        // If already loaded, just toggle visibility
        if (comment.replies && comment.replies.length > 0) {
            setComments((prev) =>
                prev.map((c) => c.id === comment.id ? { ...c, showReplies: !c.showReplies } : c)
            );
            return;
        }

        setLoadingReplies(comment.id);

        const [repliesRes, likesRes] = await Promise.all([
            supabase
                .from("post_comments")
                .select("*")
                .eq("parent_comment_id", comment.id)
                .order("created_at", { ascending: true }),
            supabase
                .from("comment_likes")
                .select("comment_id")
                .eq("user_id", currentUserId),
        ]);

        const likedIds = new Set((likesRes.data ?? []).map((l) => l.comment_id));
        const replies = (repliesRes.data ?? []).map((r) => ({ ...r, isLiked: likedIds.has(r.id) }));

        setComments((prev) =>
            prev.map((c) =>
                c.id === comment.id ? { ...c, replies, showReplies: true } : c
            )
        );
        setLoadingReplies(null);
    };

    const handleSubmitComment = async () => {
        if (!newComment.trim() || !post || submitting) return;
        setSubmitting(true);

        const { data: profile } = await supabase
            .from("profiles")
            .select("first_name, last_name")
            .eq("id", currentUserId)
            .single();

        const authorName = profile
            ? `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() || "User"
            : "User";

        const isReply = replyingTo !== null;

        const { data, error } = await supabase
            .from("post_comments")
            .insert({
                post_id: post.id,
                user_id: currentUserId,
                author_name: authorName,
                author_initials: getInitials(authorName),
                content: newComment.trim(),
                likes_count: 0,
                reply_count: 0,
                parent_comment_id: replyingTo?.id ?? null,
            })
            .select()
            .single();

        if (!error && data) {
            if (isReply && replyingTo) {
                // Increment reply_count on parent
                await supabase
                    .from("post_comments")
                    .update({ reply_count: (replyingTo.reply_count ?? 0) + 1 })
                    .eq("id", replyingTo.id);

                // Append reply into the parent's replies array
                setComments((prev) =>
                    prev.map((c) =>
                        c.id === replyingTo.id
                            ? {
                                ...c,
                                reply_count: (c.reply_count ?? 0) + 1,
                                showReplies: true,
                                replies: [...(c.replies ?? []), { ...data, isLiked: false }],
                            }
                            : c
                    )
                );
            } else {
                // Increment post comment count
                const { error: rpcError } = await supabase.rpc("increment_comments", { post_id: post.id });
                if (rpcError) {
                    await supabase
                        .from("community_posts")
                        .update({ comments_count: (post.comments_count ?? 0) + 1 })
                        .eq("id", post.id);
                }
                setComments((prev) => [...prev, { ...data, isLiked: false, replies: [], showReplies: false }]);
                onCommentCountChange(post.id, 1);
            }

            setNewComment("");
            setReplyingTo(null);
            setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150);
        }
        setSubmitting(false);
    };

    const handleLikeComment = async (commentId: string, isLiked: boolean, parentId?: string) => {
        const updateList = (list: Comment[]) =>
            list.map((c) =>
                c.id === commentId
                    ? { ...c, likes_count: isLiked ? Math.max(0, c.likes_count - 1) : c.likes_count + 1, isLiked: !isLiked }
                    : c
            );

        if (parentId) {
            setComments((prev) =>
                prev.map((c) => c.id === parentId ? { ...c, replies: updateList(c.replies ?? []) } : c)
            );
        } else {
            setComments((prev) => updateList(prev));
        }

        if (isLiked) {
            await supabase.from("comment_likes").delete().eq("comment_id", commentId).eq("user_id", currentUserId);
            const target = parentId
                ? comments.find(c => c.id === parentId)?.replies?.find(r => r.id === commentId)
                : comments.find(c => c.id === commentId);
            await supabase.from("post_comments")
                .update({ likes_count: Math.max(0, (target?.likes_count ?? 1) - 1) })
                .eq("id", commentId);
        } else {
            await supabase.from("comment_likes").insert({ comment_id: commentId, user_id: currentUserId });
            const target = parentId
                ? comments.find(c => c.id === parentId)?.replies?.find(r => r.id === commentId)
                : comments.find(c => c.id === commentId);
            await supabase.from("post_comments")
                .update({ likes_count: (target?.likes_count ?? 0) + 1 })
                .eq("id", commentId);
        }
    };

    const handleDeleteComment = async (commentId: string, parentId?: string) => {
        Alert.alert("Delete Comment", "Remove this comment?", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Delete", style: "destructive",
                onPress: async () => {
                    await supabase.from("post_comments").delete().eq("id", commentId);

                    if (parentId) {
                        setComments((prev) =>
                            prev.map((c) =>
                                c.id === parentId
                                    ? {
                                        ...c,
                                        reply_count: Math.max(0, (c.reply_count ?? 1) - 1),
                                        replies: (c.replies ?? []).filter((r) => r.id !== commentId),
                                    }
                                    : c
                            )
                        );
                        // Decrement parent reply_count in DB
                        const parent = comments.find(c => c.id === parentId);
                        if (parent) {
                            await supabase.from("post_comments")
                                .update({ reply_count: Math.max(0, (parent.reply_count ?? 1) - 1) })
                                .eq("id", parentId);
                        }
                    } else {
                        setComments((prev) => prev.filter((c) => c.id !== commentId));
                        if (post) onCommentCountChange(post.id, -1);
                    }
                },
            },
        ]);
    };

    const handleSetReply = (comment: Comment) => {
        setReplyingTo(comment);
        setTimeout(() => inputRef.current?.focus(), 100);
    };

    const cfg = post ? (categoryConfig[post.category] ?? fallbackConfig) : fallbackConfig;

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
                <View style={cs.overlay}>
                    <View style={cs.sheet}>
                        {/* Header */}
                        <View style={cs.sheetHeader}>
                            <View style={{ flex: 1 }}>
                                <Text style={cs.sheetTitle} numberOfLines={1}>{post?.title}</Text>
                                <Text style={[cs.sheetCat, { color: cfg.color }]}>{post?.category}</Text>
                            </View>
                            <TouchableOpacity onPress={onClose}>
                                <X size={22} color="#888" />
                            </TouchableOpacity>
                        </View>

                        {/* Comments */}
                        <ScrollView
                            ref={scrollRef}
                            style={{ flex: 1 }}
                            contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 20 }}
                            showsVerticalScrollIndicator={false}
                        >
                            {loading ? (
                                <Text style={{ color: "#555", textAlign: "center", marginTop: 20 }}>Loading...</Text>
                            ) : comments.length === 0 ? (
                                <View style={cs.emptyComments}>
                                    <MessageSquare size={32} color="#333" />
                                    <Text style={cs.emptyCommentsText}>No comments yet. Be the first!</Text>
                                </View>
                            ) : (
                                comments.map((comment) => (
                                    <CommentThread
                                        key={comment.id}
                                        comment={comment}
                                        currentUserId={currentUserId}
                                        onLike={handleLikeComment}
                                        onDelete={handleDeleteComment}
                                        onReply={handleSetReply}
                                        onToggleReplies={handleToggleReplies}
                                        loadingReplies={loadingReplies}
                                    />
                                ))
                            )}
                        </ScrollView>

                        {/* Reply banner */}
                        {replyingTo && (
                            <View style={cs.replyBanner}>
                                <CornerDownRight size={14} color="#22c55e" />
                                <Text style={cs.replyBannerText} numberOfLines={1}>
                                    Replying to <Text style={{ color: "#22c55e" }}>{replyingTo.author_name}</Text>
                                </Text>
                                <TouchableOpacity onPress={() => setReplyingTo(null)}>
                                    <X size={16} color="#555" />
                                </TouchableOpacity>
                            </View>
                        )}

                        {/* Input */}
                        <View style={cs.inputRow}>
                            <TextInput
                                ref={inputRef}
                                style={cs.commentInput}
                                placeholder={replyingTo ? `Reply to ${replyingTo.author_name}...` : "Write a comment..."}
                                placeholderTextColor="#555"
                                value={newComment}
                                onChangeText={setNewComment}
                                multiline
                                maxLength={300}
                            />
                            <TouchableOpacity
                                style={[cs.sendBtn, (!newComment.trim() || submitting) && cs.sendBtnOff]}
                                onPress={handleSubmitComment}
                                disabled={!newComment.trim() || submitting}
                            >
                                <Send size={16} color="#fff" />
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

// ─── Main Screen ──────────────────────────────
export default function CommunityForum() {
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [activeCategory, setActiveCategory] = useState("All");
    const [modalVisible, setModalVisible] = useState(false);
    const [commentsModal, setCommentsModal] = useState<{ visible: boolean; post: Post | null }>({ visible: false, post: null });
    const [newPost, setNewPost] = useState({ title: "", content: "", category: "Discussion" });
    const [submitting, setSubmitting] = useState(false);
    const [currentUserId, setCurrentUserId] = useState("");
    const [currentUserName, setCurrentUserName] = useState("User");
    // Media for new post
    const [selectedMedia, setSelectedMedia] = useState<Array<{ uri: string; type: "image" | "video" }>>([]);
    const [uploadingMedia, setUploadingMedia] = useState(false);

    useEffect(() => {
        initUser();
    }, []);

    const initUser = async () => {
        const { data: auth } = await supabase.auth.getUser();
        if (!auth.user) return;
        setCurrentUserId(auth.user.id);

        const { data: profile } = await supabase
            .from("profiles")
            .select("first_name, last_name")
            .eq("id", auth.user.id)
            .single();

        if (profile) {
            const name = `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() || "User";
            setCurrentUserName(name);
        }

        loadPosts(auth.user.id);
    };

    const loadPosts = async (userId?: string) => {
        setLoading(true);
        const uid = userId ?? currentUserId;

        const [postsRes, likesRes] = await Promise.all([
            supabase
                .from("community_posts")
                .select("*, post_media(*)")
                .order("created_at", { ascending: false }),
            supabase
                .from("post_likes")
                .select("post_id")
                .eq("user_id", uid),
        ]);

        const likedIds = new Set((likesRes.data ?? []).map((l) => l.post_id));
        setPosts(
            (postsRes.data ?? []).map((p) => ({
                ...p,
                isLiked: likedIds.has(p.id),
                media: p.post_media ?? [],
            }))
        );
        setLoading(false);
        setRefreshing(false);
    };

    const handleRefresh = () => {
        setRefreshing(true);
        loadPosts();
    };

    const handlePickMedia = async () => {
        if (selectedMedia.length >= 4) {
            Alert.alert("Limit reached", "You can attach up to 4 images per post.");
            return;
        }
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") {
            Alert.alert("Permission needed", "Allow photo access to attach images.");
            return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsMultipleSelection: true,
            selectionLimit: 4 - selectedMedia.length,
            quality: 0.8,
        });
        if (!result.canceled) {
            const picked = result.assets.map((a) => ({
                uri: a.uri,
                type: "image" as const,
            }));
            setSelectedMedia((prev) => [...prev, ...picked].slice(0, 4));
        }
    };

    const handleRemoveMedia = (index: number) => {
        setSelectedMedia((prev) => prev.filter((_, i) => i !== index));
    };

    const handleLikePost = async (postId: string, isLiked: boolean) => {
        if (!currentUserId) return;
        setPosts((prev) => prev.map((p) =>
            p.id === postId
                ? { ...p, likes_count: isLiked ? p.likes_count - 1 : p.likes_count + 1, isLiked: !isLiked }
                : p
        ));
        if (isLiked) {
            await supabase.from("post_likes").delete().eq("post_id", postId).eq("user_id", currentUserId);
            await supabase.from("community_posts")
                .update({ likes_count: posts.find(p => p.id === postId)!.likes_count - 1 })
                .eq("id", postId);
        } else {
            await supabase.from("post_likes").insert({ post_id: postId, user_id: currentUserId });
            await supabase.from("community_posts")
                .update({ likes_count: posts.find(p => p.id === postId)!.likes_count + 1 })
                .eq("id", postId);
        }
    };

    const handleDeletePost = async (postId: string) => {
        Alert.alert("Delete Post", "Are you sure you want to delete this post?", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Delete", style: "destructive",
                onPress: async () => {
                    // Delete media from storage
                    const post = posts.find(p => p.id === postId);
                    if (post?.media && post.media.length > 0) {
                        const paths = post.media
                            .filter(m => m.url)
                            .map(m => m.url.split("/post-media/")[1])
                            .filter(Boolean);
                        if (paths.length > 0) {
                            await supabase.storage.from("post-media").remove(paths);
                        }
                    }
                    await supabase.from("community_posts").delete().eq("id", postId);
                    setPosts((prev) => prev.filter((p) => p.id !== postId));
                },
            },
        ]);
    };

    const handleCreatePost = async () => {
        if (!newPost.title.trim() || !newPost.content.trim()) {
            Alert.alert("Missing Fields", "Please fill in title and content.");
            return;
        }
        if (!currentUserId) return;
        setSubmitting(true);
        setUploadingMedia(selectedMedia.length > 0);

        const { data, error } = await supabase
            .from("community_posts")
            .insert({
                user_id: currentUserId,
                author_name: currentUserName,
                author_initials: getInitials(currentUserName),
                title: newPost.title.trim(),
                content: newPost.content.trim(),
                category: newPost.category,
                likes_count: 0,
                comments_count: 0,
            })
            .select()
            .single();

        if (error || !data) {
            Alert.alert("Error", error?.message ?? "Could not create post.");
            setSubmitting(false);
            setUploadingMedia(false);
            return;
        }

        // Upload media if any
        let uploadedMedia: PostMedia[] = [];
        if (selectedMedia.length > 0) {
            const uploads = await Promise.all(
                selectedMedia.map((m) => uploadMedia(m.uri, currentUserId, data.id, m.type))
            );
            const validUploads = uploads.filter(Boolean) as { url: string; storage_path: string }[];

            if (validUploads.length > 0) {
                const mediaRows = validUploads.map((u) => ({
                    post_id: data.id,
                    user_id: currentUserId,
                    url: u.url,
                    storage_path: u.storage_path,
                    media_type: "image",
                }));
                const { data: mediaData } = await supabase
                    .from("post_media")
                    .insert(mediaRows)
                    .select();
                uploadedMedia = (mediaData ?? []) as PostMedia[];
            }
        }

        setPosts((prev) => [{ ...data, isLiked: false, media: uploadedMedia }, ...prev]);
        setModalVisible(false);
        setNewPost({ title: "", content: "", category: "Discussion" });
        setSelectedMedia([]);
        setSubmitting(false);
        setUploadingMedia(false);
    };

    const handleCommentCountChange = (postId: string, delta: number) => {
        setPosts((prev) => prev.map((p) =>
            p.id === postId ? { ...p, comments_count: Math.max(0, p.comments_count + delta) } : p
        ));
    };

    const filteredPosts = posts.filter(
        (post) =>
            (activeCategory === "All" || post.category === activeCategory) &&
            (post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                post.content.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    return (
        <View style={styles.container}>
            <StatusBar style="light" />

            {/* Header */}
            <View style={styles.header}>
                <View style={styles.headerTop}>
                    <Text style={styles.headerTitle}>Community</Text>
                    <View style={styles.headerRight}>
                        <View style={styles.searchContainer}>
                            <Search size={14} color="#888" />
                            <TextInput
                                placeholder="Search..."
                                placeholderTextColor="#555"
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                                style={styles.searchInput}
                            />
                        </View>
                        <TouchableOpacity style={styles.newPostBtn} onPress={() => setModalVisible(true)}>
                            <Plus size={16} color="#0a0a0a" />
                        </TouchableOpacity>
                    </View>
                </View>
            </View>

            {/* Category Filter */}
            <View style={styles.categoriesWrapper}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoriesRow}>
                    {CATEGORIES.map((cat) => {
                        const cfg = categoryConfig[cat] ?? { color: "#22c55e", tint: "rgba(34,197,94,0.10)", border: "rgba(34,197,94,0.22)" };
                        const isActive = activeCategory === cat;
                        return (
                            <TouchableOpacity
                                key={cat}
                                style={[
                                    styles.catBtn,
                                    isActive && cat !== "All" && { backgroundColor: cfg.tint, borderColor: cfg.color },
                                    isActive && cat === "All" && styles.catBtnActiveAll,
                                ]}
                                onPress={() => setActiveCategory(cat)}
                            >
                                <Text style={[
                                    styles.catBtnText,
                                    isActive && cat !== "All" && { color: cfg.color, fontWeight: "700" },
                                    isActive && cat === "All" && styles.catBtnTextActiveAll,
                                ]}>
                                    {cat}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            </View>

            {/* Posts */}
            <ScrollView
                contentContainerStyle={styles.body}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#22c55e" />
                }
            >
                {loading ? (
                    <View style={styles.emptyCard}>
                        <Text style={{ color: "#555", fontSize: 14 }}>Loading posts...</Text>
                    </View>
                ) : filteredPosts.length === 0 ? (
                    <View style={styles.emptyCard}>
                        <Users size={48} color="#444" />
                        <Text style={styles.emptyText}>
                            {searchQuery ? "No posts match your search" : "No posts yet. Be the first!"}
                        </Text>
                    </View>
                ) : (
                    filteredPosts.map((post) => {
                        const cfg = categoryConfig[post.category] ?? fallbackConfig;
                        const isOwn = post.user_id === currentUserId;
                        return (
                            <View key={post.id} style={[styles.postCard, { backgroundColor: cfg.tint, borderColor: cfg.border, borderWidth: 1 }]}>
                                <View style={[styles.accentBar, { backgroundColor: cfg.color }]} />
                                <View style={styles.postHeader}>
                                    <View style={[styles.avatarCircle, { backgroundColor: `${cfg.color}22` }]}>
                                        <Text style={[styles.avatarText, { color: cfg.color }]}>{post.author_initials}</Text>
                                    </View>
                                    <View style={styles.postMeta}>
                                        <View style={styles.postMetaTop}>
                                            <Text style={styles.authorName}>{post.author_name}</Text>
                                            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                                                <Text style={styles.timestamp}>{timeAgo(post.created_at)}</Text>
                                                {isOwn && (
                                                    <TouchableOpacity onPress={() => handleDeletePost(post.id)}>
                                                        <Trash2 size={13} color="#555" />
                                                    </TouchableOpacity>
                                                )}
                                            </View>
                                        </View>
                                        <View style={[styles.categoryBadge, { borderColor: cfg.border, backgroundColor: `${cfg.color}18` }]}>
                                            <Text style={[styles.categoryBadgeText, { color: cfg.color }]}>{post.category}</Text>
                                        </View>
                                    </View>
                                </View>

                                <Text style={styles.postTitle}>{post.title}</Text>
                                <Text style={styles.postContent}>{post.content}</Text>

                                {/* Media Gallery */}
                                {post.media && post.media.length > 0 && (
                                    <PostMediaGallery media={post.media} />
                                )}

                                <View style={[styles.postActions, { borderTopColor: cfg.border }]}>
                                    <TouchableOpacity
                                        style={styles.actionBtn}
                                        onPress={() => handleLikePost(post.id, post.isLiked ?? false)}
                                    >
                                        <Heart
                                            size={18}
                                            color={post.isLiked ? "#ef4444" : "#888"}
                                            fill={post.isLiked ? "#ef4444" : "transparent"}
                                        />
                                        <Text style={[styles.actionText, post.isLiked && { color: "#ef4444" }]}>
                                            {post.likes_count}
                                        </Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={styles.actionBtn}
                                        onPress={() => setCommentsModal({ visible: true, post })}
                                    >
                                        <MessageSquare size={18} color="#888" />
                                        <Text style={styles.actionText}>{post.comments_count}</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        );
                    })
                )}

                {/* Trending */}
                <View style={styles.trendingSection}>
                    <Text style={styles.sectionTitle}>Trending Topics</Text>
                    <View style={styles.tagsRow}>
                        {TRENDING.map((tag) => (
                            <TouchableOpacity
                                key={tag}
                                style={styles.tag}
                                onPress={() => setSearchQuery(tag.replace("#", ""))}
                            >
                                <Text style={styles.tagText}>{tag}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            </ScrollView>

            {/* Create Post Modal */}
            <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
                <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
                    <View style={styles.modalOverlay}>
                        <ScrollView
                            style={{ width: "100%" }}
                            contentContainerStyle={styles.modalContent}
                            keyboardShouldPersistTaps="handled"
                        >
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>Create Post</Text>
                                <TouchableOpacity onPress={() => { setModalVisible(false); setSelectedMedia([]); }}>
                                    <X size={22} color="#888" />
                                </TouchableOpacity>
                            </View>

                            <Text style={styles.inputLabel}>Title</Text>
                            <TextInput
                                placeholder="What's on your mind?"
                                placeholderTextColor="#555"
                                value={newPost.title}
                                onChangeText={(v) => setNewPost({ ...newPost, title: v })}
                                style={styles.input}
                            />

                            <Text style={styles.inputLabel}>Category</Text>
                            <View style={styles.catPickerRow}>
                                {POST_CATEGORIES.map((cat) => {
                                    const cfg = categoryConfig[cat] ?? fallbackConfig;
                                    const isActive = newPost.category === cat;
                                    return (
                                        <TouchableOpacity
                                            key={cat}
                                            style={[styles.catPickerBtn, isActive && { backgroundColor: cfg.tint, borderColor: cfg.color }]}
                                            onPress={() => setNewPost({ ...newPost, category: cat })}
                                        >
                                            <Text style={[styles.catPickerText, isActive && { color: cfg.color, fontWeight: "700" }]}>
                                                {cat}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            <Text style={styles.inputLabel}>Content</Text>
                            <TextInput
                                placeholder="Share your thoughts, questions, or achievements..."
                                placeholderTextColor="#555"
                                value={newPost.content}
                                onChangeText={(v) => setNewPost({ ...newPost, content: v })}
                                style={[styles.input, styles.textarea]}
                                multiline
                                numberOfLines={4}
                                textAlignVertical="top"
                            />

                            {/* Media Picker */}
                            <Text style={styles.inputLabel}>Photos <Text style={{ color: "#555", fontWeight: "400" }}>(optional, up to 4)</Text></Text>
                            <View style={styles.mediaPicker}>
                                {selectedMedia.map((m, idx) => (
                                    <View key={idx} style={styles.mediaThumbContainer}>
                                        <Image source={{ uri: m.uri }} style={styles.mediaThumb} resizeMode="cover" />
                                        <TouchableOpacity
                                            style={styles.mediaRemoveBtn}
                                            onPress={() => handleRemoveMedia(idx)}
                                        >
                                            <X size={10} color="#fff" />
                                        </TouchableOpacity>
                                    </View>
                                ))}
                                {selectedMedia.length < 4 && (
                                    <TouchableOpacity style={styles.mediaAddBtn} onPress={handlePickMedia}>
                                        <ImageIcon size={20} color="#555" />
                                        <Text style={styles.mediaAddText}>Add</Text>
                                    </TouchableOpacity>
                                )}
                            </View>

                            <TouchableOpacity
                                style={[styles.submitBtn, (submitting || uploadingMedia) && { opacity: 0.6 }]}
                                onPress={handleCreatePost}
                                disabled={submitting || uploadingMedia}
                            >
                                {uploadingMedia ? (
                                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                                        <ActivityIndicator size="small" color="#fff" />
                                        <Text style={styles.submitBtnText}>Uploading...</Text>
                                    </View>
                                ) : (
                                    <Text style={styles.submitBtnText}>{submitting ? "Posting..." : "Post"}</Text>
                                )}
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {/* Comments Modal */}
            <CommentsModal
                visible={commentsModal.visible}
                post={commentsModal.post}
                currentUserId={currentUserId}
                onClose={() => setCommentsModal({ visible: false, post: null })}
                onCommentCountChange={handleCommentCountChange}
            />
        </View>
    );
}

// ─── Comment Styles ───────────────────────────
const cs = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.75)", justifyContent: "flex-end" },
    sheet: {
        backgroundColor: "#1a1a1a",
        borderTopLeftRadius: 28, borderTopRightRadius: 28,
        height: "80%",
        overflow: "hidden",
    },
    sheetHeader: {
        flexDirection: "row", alignItems: "center", gap: 12,
        padding: 20, borderBottomWidth: 1, borderBottomColor: "#2a2a2a",
    },
    sheetTitle: { color: "#fff", fontSize: 16, fontWeight: "700" },
    sheetCat: { fontSize: 12, marginTop: 2 },
    emptyComments: { alignItems: "center", paddingTop: 40, gap: 12 },
    emptyCommentsText: { color: "#555", fontSize: 14 },

    // Top-level comment
    commentCard: {
        backgroundColor: "#111", borderRadius: 14, padding: 12,
        borderWidth: 1, borderColor: "#2a2a2a",
    },
    // Reply card — indented, lighter border
    replyCard: {
        backgroundColor: "#0d0d0d",
        borderColor: "#222",
        marginLeft: 0,
        position: "relative",
    },
    replyConnector: {
        position: "absolute",
        left: -12,
        top: 0,
        bottom: 0,
        width: 2,
        backgroundColor: "#2a2a2a",
        borderRadius: 1,
    },
    repliesContainer: {
        marginLeft: 24,
        gap: 6,
        borderLeftWidth: 2,
        borderLeftColor: "#2a2a2a",
        paddingLeft: 12,
    },
    commentHeader: { flexDirection: "row", gap: 10 },
    commentAvatar: {
        width: 34, height: 34, borderRadius: 17,
        backgroundColor: "rgba(34,197,94,0.12)",
        alignItems: "center", justifyContent: "center", flexShrink: 0,
    },
    replyAvatar: { width: 28, height: 28, borderRadius: 14 },
    commentAvatarText: { color: "#22c55e", fontSize: 12, fontWeight: "700" },
    commentAuthor: { color: "#fff", fontSize: 13, fontWeight: "600" },
    commentTime: { color: "#555", fontSize: 11 },
    commentContent: { color: "#aaa", fontSize: 13, lineHeight: 20, marginTop: 6 },
    commentActions: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 8 },
    commentLikeBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
    commentLikeCount: { color: "#555", fontSize: 12 },

    // Reply toggle
    toggleRepliesBtn: {
        flexDirection: "row", alignItems: "center", gap: 6,
        marginLeft: 24, paddingVertical: 4,
    },
    toggleRepliesText: { color: "#22c55e", fontSize: 12, fontWeight: "600" },

    // Reply banner above input
    replyBanner: {
        flexDirection: "row", alignItems: "center", gap: 8,
        backgroundColor: "#111", paddingHorizontal: 16, paddingVertical: 8,
        borderTopWidth: 1, borderTopColor: "#2a2a2a",
    },
    replyBannerText: { flex: 1, color: "#888", fontSize: 12 },

    inputRow: {
        flexDirection: "row", alignItems: "flex-end", gap: 10,
        padding: 12, borderTopWidth: 1, borderTopColor: "#2a2a2a",
        backgroundColor: "#1a1a1a",
    },
    commentInput: {
        flex: 1, backgroundColor: "#2a2a2a", borderRadius: 22,
        paddingHorizontal: 16, paddingVertical: 10,
        color: "#fff", fontSize: 14, maxHeight: 100,
        borderWidth: 1, borderColor: "#333",
    },
    sendBtn: {
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: "#22c55e", alignItems: "center", justifyContent: "center",
    },
    sendBtnOff: { backgroundColor: "#2a2a2a" },
});

// ─── Main Styles ──────────────────────────────
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#0a0a0a" },
    header: {
        backgroundColor: "#1a1a1a", paddingHorizontal: 16,
        paddingTop: 52, paddingBottom: 10,
        shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.4, shadowRadius: 6, elevation: 6,
    },
    headerTop: { flexDirection: "row", alignItems: "center", gap: 10 },
    headerTitle: { color: "#fff", fontSize: 18, fontWeight: "700" },
    headerRight: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 8 },
    searchContainer: {
        flex: 1, flexDirection: "row", alignItems: "center",
        backgroundColor: "#2a2a2a", borderRadius: 10, paddingHorizontal: 10, gap: 6,
    },
    searchInput: { flex: 1, color: "#fff", fontSize: 13, paddingVertical: 8 },
    newPostBtn: { width: 34, height: 34, alignItems: "center", justifyContent: "center", backgroundColor: "#22c55e", borderRadius: 10 },
    categoriesWrapper: { backgroundColor: "#1a1a1a", borderBottomWidth: 1, borderBottomColor: "#2a2a2a" },
    categoriesRow: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
    catBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: "#3a3a3a", backgroundColor: "#2a2a2a" },
    catBtnActiveAll: { backgroundColor: "#22c55e", borderColor: "#22c55e" },
    catBtnText: { color: "#888", fontSize: 13, fontWeight: "500" },
    catBtnTextActiveAll: { color: "#0a0a0a", fontWeight: "700" },
    body: { padding: 16, gap: 14, paddingBottom: 100 },
    emptyCard: { backgroundColor: "#1a1a1a", borderRadius: 20, padding: 48, alignItems: "center", gap: 12 },
    emptyText: { color: "#555", fontSize: 14 },
    postCard: { borderRadius: 16, padding: 16, paddingLeft: 20, gap: 10, overflow: "hidden", position: "relative" },
    accentBar: { position: "absolute", left: 0, top: 0, bottom: 0, width: 4, borderTopLeftRadius: 16, borderBottomLeftRadius: 16 },
    postHeader: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
    avatarCircle: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", flexShrink: 0 },
    avatarText: { fontSize: 13, fontWeight: "700" },
    postMeta: { flex: 1 },
    postMetaTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 5 },
    authorName: { color: "#fff", fontSize: 14, fontWeight: "600" },
    timestamp: { color: "#666", fontSize: 12 },
    categoryBadge: { alignSelf: "flex-start", borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
    categoryBadgeText: { fontSize: 11, fontWeight: "600" },
    postTitle: { color: "#fff", fontSize: 15, fontWeight: "600" },
    postContent: { color: "#aaa", fontSize: 13, lineHeight: 20 },
    postActions: { flexDirection: "row", gap: 16, paddingTop: 10, borderTopWidth: 1 },
    actionBtn: { flexDirection: "row", alignItems: "center", gap: 6 },
    actionText: { color: "#888", fontSize: 13 },
    trendingSection: { gap: 10, marginTop: 8 },
    sectionTitle: { color: "#fff", fontSize: 16, fontWeight: "600" },
    tagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    tag: { backgroundColor: "#2a2a2a", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
    tagText: { color: "#22c55e", fontSize: 13, fontWeight: "500" },
    modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.75)", justifyContent: "flex-end" },
    modalContent: {
        backgroundColor: "#1a1a1a", borderTopLeftRadius: 28, borderTopRightRadius: 28,
        padding: 24, paddingBottom: 40,
    },
    modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
    modalTitle: { color: "#fff", fontSize: 18, fontWeight: "700" },
    inputLabel: { color: "#888", fontSize: 13, fontWeight: "500", marginBottom: 8 },
    input: { backgroundColor: "#2a2a2a", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: "#fff", fontSize: 14, marginBottom: 16 },
    textarea: { minHeight: 100 },
    catPickerRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
    catPickerBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: "#3a3a3a", backgroundColor: "#2a2a2a" },
    catPickerText: { color: "#888", fontSize: 13 },
    submitBtn: { backgroundColor: "#22c55e", borderRadius: 14, paddingVertical: 15, alignItems: "center", marginTop: 4, shadowColor: "#22c55e", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 },
    submitBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },

    // Media picker styles
    mediaPicker: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
    mediaThumbContainer: { width: 72, height: 72, borderRadius: 10, overflow: "hidden", position: "relative" },
    mediaThumb: { width: "100%", height: "100%" },
    mediaRemoveBtn: {
        position: "absolute", top: 4, right: 4,
        backgroundColor: "rgba(0,0,0,0.6)", borderRadius: 10,
        width: 18, height: 18, alignItems: "center", justifyContent: "center",
    },
    mediaAddBtn: {
        width: 72, height: 72, borderRadius: 10,
        backgroundColor: "#2a2a2a", borderWidth: 1, borderColor: "#3a3a3a",
        borderStyle: "dashed", alignItems: "center", justifyContent: "center", gap: 4,
    },
    mediaAddText: { color: "#555", fontSize: 11 },
});