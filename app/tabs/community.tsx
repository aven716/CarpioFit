import { StatusBar } from "expo-status-bar";
import { Heart, MessageSquare, Plus, Search, Users, X } from "lucide-react-native";
import { useState } from "react";
import {
    Alert,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from "react-native";

interface Post {
    id: string;
    author: string;
    avatar: string;
    title: string;
    content: string;
    category: string;
    likes: number;
    comments: number;
    timestamp: string;
    isLiked?: boolean;
}

const CATEGORIES = ["All", "Achievement", "Nutrition", "Motivation", "Discussion", "Questions"];
const POST_CATEGORIES = CATEGORIES.slice(1);
const TRENDING = ["#WeightLoss", "#MealPrep", "#RunningTips", "#HomeWorkout", "#Motivation"];

const categoryConfig: Record<string, { color: string; tint: string; border: string; accent: string }> = {
    Achievement: { color: "#f59e0b", tint: "rgba(245,158,11,0.10)", border: "rgba(245,158,11,0.22)", accent: "#f59e0b" },
    Nutrition: { color: "#22c55e", tint: "rgba(34,197,94,0.10)", border: "rgba(34,197,94,0.22)", accent: "#22c55e" },
    Motivation: { color: "#a855f7", tint: "rgba(168,85,247,0.10)", border: "rgba(168,85,247,0.22)", accent: "#a855f7" },
    Discussion: { color: "#3b82f6", tint: "rgba(59,130,246,0.10)", border: "rgba(59,130,246,0.22)", accent: "#3b82f6" },
    Questions: { color: "#f97316", tint: "rgba(249,115,22,0.10)", border: "rgba(249,115,22,0.22)", accent: "#f97316" },
};

const fallbackConfig = { color: "#888", tint: "rgba(136,136,136,0.10)", border: "rgba(136,136,136,0.22)", accent: "#888" };

const INITIAL_POSTS: Post[] = [
    {
        id: "1", author: "Sarah M.", avatar: "SM",
        title: "Just completed my first 10K!",
        content: "After 3 months of training, I finally did it! The feeling is incredible. For anyone starting out, consistency is key. You got this! 💪",
        category: "Achievement", likes: 24, comments: 8, timestamp: "2h ago",
    },
    {
        id: "2", author: "Mike T.", avatar: "MT",
        title: "Best post-workout recovery foods?",
        content: "Looking for recommendations on what to eat after intense workouts. What works best for you?",
        category: "Nutrition", likes: 12, comments: 15, timestamp: "4h ago",
    },
    {
        id: "3", author: "Emma L.", avatar: "EL",
        title: "Yoga for beginners - my journey",
        content: "Started yoga 6 weeks ago and I'm already feeling more flexible and less stressed. Anyone else love morning yoga sessions?",
        category: "Motivation", likes: 18, comments: 6, timestamp: "1d ago",
    },
    {
        id: "4", author: "Alex R.", avatar: "AR",
        title: "Home gym setup on a budget?",
        content: "Want to build a home gym but budget is tight. What are the essential pieces of equipment I should start with?",
        category: "Discussion", likes: 9, comments: 12, timestamp: "1d ago",
    },
];

export default function CommunityForum() {
    const [posts, setPosts] = useState<Post[]>(INITIAL_POSTS);
    const [searchQuery, setSearchQuery] = useState("");
    const [activeCategory, setActiveCategory] = useState("All");
    const [modalVisible, setModalVisible] = useState(false);
    const [newPost, setNewPost] = useState({ title: "", content: "", category: "Discussion" });

    const filteredPosts = posts.filter(
        (post) =>
            (activeCategory === "All" || post.category === activeCategory) &&
            (post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                post.content.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    const createPost = () => {
        if (!newPost.title || !newPost.content) {
            Alert.alert("Missing Fields", "Please fill in all fields.");
            return;
        }
        const post: Post = {
            id: Date.now().toString(),
            author: "You", avatar: "YO",
            title: newPost.title,
            content: newPost.content,
            category: newPost.category,
            likes: 0, comments: 0, timestamp: "Just now",
        };
        setPosts([post, ...posts]);
        setModalVisible(false);
        setNewPost({ title: "", content: "", category: "Discussion" });
    };

    const toggleLike = (postId: string) => {
        setPosts(posts.map((p) =>
            p.id === postId
                ? { ...p, likes: p.isLiked ? p.likes - 1 : p.likes + 1, isLiked: !p.isLiked }
                : p
        ));
    };

    return (
        <View style={styles.container}>
            <StatusBar style="light" />

            {/* Compact Header */}
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

            {/* Posts + Trending */}
            <ScrollView contentContainerStyle={styles.body}>

                {filteredPosts.length === 0 ? (
                    <View style={styles.emptyCard}>
                        <Users size={48} color="#444" />
                        <Text style={styles.emptyText}>No posts found</Text>
                    </View>
                ) : (
                    filteredPosts.map((post) => {
                        const cfg = categoryConfig[post.category] ?? fallbackConfig;
                        return (
                            <View
                                key={post.id}
                                style={[
                                    styles.postCard,
                                    { backgroundColor: cfg.tint, borderColor: cfg.border, borderWidth: 1 },
                                ]}
                            >
                              

                                <View style={styles.postHeader}>
                                    <View style={[styles.avatarCircle, { backgroundColor: `${cfg.color}22` }]}>
                                        <Text style={[styles.avatarText, { color: cfg.color }]}>{post.avatar}</Text>
                                    </View>
                                    <View style={styles.postMeta}>
                                        <View style={styles.postMetaTop}>
                                            <Text style={styles.authorName}>{post.author}</Text>
                                            <Text style={styles.timestamp}>{post.timestamp}</Text>
                                        </View>
                                        <View style={[styles.categoryBadge, { borderColor: cfg.border, backgroundColor: `${cfg.color}18` }]}>
                                            <Text style={[styles.categoryBadgeText, { color: cfg.color }]}>{post.category}</Text>
                                        </View>
                                    </View>
                                </View>

                                <Text style={styles.postTitle}>{post.title}</Text>
                                <Text style={styles.postContent}>{post.content}</Text>

                                <View style={[styles.postActions, { borderTopColor: cfg.border }]}>
                                    <TouchableOpacity style={styles.actionBtn} onPress={() => toggleLike(post.id)}>
                                        <Heart
                                            size={18}
                                            color={post.isLiked ? cfg.color : "#888"}
                                            fill={post.isLiked ? cfg.color : "transparent"}
                                        />
                                        <Text style={[styles.actionText, post.isLiked && { color: cfg.color }]}>
                                            {post.likes}
                                        </Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.actionBtn}>
                                        <MessageSquare size={18} color="#888" />
                                        <Text style={styles.actionText}>{post.comments}</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        );
                    })
                )}

                <View style={styles.trendingSection}>
                    <Text style={styles.sectionTitle}>Trending Topics</Text>
                    <View style={styles.tagsRow}>
                        {TRENDING.map((tag) => (
                            <TouchableOpacity key={tag} style={styles.tag}>
                                <Text style={styles.tagText}>{tag}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

            </ScrollView>

            {/* New Post Modal */}
            <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>

                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Create Post</Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
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
                                        style={[
                                            styles.catPickerBtn,
                                            isActive && { backgroundColor: cfg.tint, borderColor: cfg.color },
                                        ]}
                                        onPress={() => setNewPost({ ...newPost, category: cat })}
                                    >
                                        <Text style={[
                                            styles.catPickerText,
                                            isActive && { color: cfg.color, fontWeight: "700" },
                                        ]}>
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

                        <TouchableOpacity style={styles.submitBtn} onPress={createPost}>
                            <Text style={styles.submitBtnText}>Post</Text>
                        </TouchableOpacity>

                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#0a0a0a" },

    // Header — compact single row
    header: {
        backgroundColor: "#1a1a1a",
        paddingHorizontal: 16,
        paddingTop: 52,
        paddingBottom: 10,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.4,
        shadowRadius: 6,
        elevation: 6,
    },
    headerTop: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
    },
    headerTitle: { color: "#fff", fontSize: 18, fontWeight: "700" },
    headerRight: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "flex-end",
        gap: 8,
    },
    searchContainer: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#2a2a2a",
        borderRadius: 10,
        paddingHorizontal: 10,
        gap: 6,
    },
    searchInput: { flex: 1, color: "#fff", fontSize: 13, paddingVertical: 8 },
    newPostBtn: {
        width: 34,
        height: 34,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#22c55e",
        borderRadius: 10,
    },

    // Categories
    categoriesWrapper: {
        backgroundColor: "#1a1a1a",
        borderBottomWidth: 1,
        borderBottomColor: "#2a2a2a",
    },
    categoriesRow: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
    catBtn: {
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: "#3a3a3a",
        backgroundColor: "#2a2a2a",
    },
    catBtnActiveAll: { backgroundColor: "#22c55e", borderColor: "#22c55e" },
    catBtnText: { color: "#888", fontSize: 13, fontWeight: "500" },
    catBtnTextActiveAll: { color: "#0a0a0a", fontWeight: "700" },

    // Body
    body: { padding: 16, gap: 14, paddingBottom: 100 },

    // Empty
    emptyCard: {
        backgroundColor: "#1a1a1a",
        borderRadius: 20,
        padding: 48,
        alignItems: "center",
        gap: 12,
    },
    emptyText: { color: "#555", fontSize: 14 },

    // Post Card
    postCard: {
        borderRadius: 16,
        padding: 16,
        paddingLeft: 20,
        gap: 10,
        overflow: "hidden",
        position: "relative",
    },
    accentBar: {
        position: "absolute",
        left: 0, top: 0, bottom: 0,
        width: 4,
        borderTopLeftRadius: 16,
        borderBottomLeftRadius: 16,
    },
    postHeader: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
    avatarCircle: {
        width: 42, height: 42, borderRadius: 21,
        alignItems: "center", justifyContent: "center",
        flexShrink: 0,
    },
    avatarText: { fontSize: 13, fontWeight: "700" },
    postMeta: { flex: 1 },
    postMetaTop: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 5,
    },
    authorName: { color: "#fff", fontSize: 14, fontWeight: "600" },
    timestamp: { color: "#666", fontSize: 12 },
    categoryBadge: {
        alignSelf: "flex-start",
        borderWidth: 1,
        borderRadius: 6,
        paddingHorizontal: 8,
        paddingVertical: 2,
    },
    categoryBadgeText: { fontSize: 11, fontWeight: "600" },
    postTitle: { color: "#fff", fontSize: 15, fontWeight: "600" },
    postContent: { color: "#aaa", fontSize: 13, lineHeight: 20 },
    postActions: {
        flexDirection: "row",
        gap: 16,
        paddingTop: 10,
        borderTopWidth: 1,
    },
    actionBtn: { flexDirection: "row", alignItems: "center", gap: 6 },
    actionText: { color: "#888", fontSize: 13 },

    // Trending
    trendingSection: { gap: 10, marginTop: 8 },
    sectionTitle: { color: "#fff", fontSize: 16, fontWeight: "600" },
    tagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    tag: {
        backgroundColor: "#2a2a2a",
        borderRadius: 20,
        paddingHorizontal: 14,
        paddingVertical: 7,
    },
    tagText: { color: "#22c55e", fontSize: 13, fontWeight: "500" },

    // Modal
    modalOverlay: {
        flex: 1, backgroundColor: "rgba(0,0,0,0.75)", justifyContent: "flex-end",
    },
    modalContent: {
        backgroundColor: "#1a1a1a",
        borderTopLeftRadius: 28, borderTopRightRadius: 28,
        padding: 24,
    },
    modalHeader: {
        flexDirection: "row", justifyContent: "space-between",
        alignItems: "center", marginBottom: 20,
    },
    modalTitle: { color: "#fff", fontSize: 18, fontWeight: "700" },
    inputLabel: { color: "#888", fontSize: 13, fontWeight: "500", marginBottom: 8 },
    input: {
        backgroundColor: "#2a2a2a", borderRadius: 12,
        paddingHorizontal: 14, paddingVertical: 12,
        color: "#fff", fontSize: 14, marginBottom: 16,
    },
    textarea: { minHeight: 100 },
    catPickerRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
    catPickerBtn: {
        paddingHorizontal: 14, paddingVertical: 7,
        borderRadius: 20, borderWidth: 1, borderColor: "#3a3a3a",
        backgroundColor: "#2a2a2a",
    },
    catPickerText: { color: "#888", fontSize: 13 },
    submitBtn: {
        backgroundColor: "#22c55e", borderRadius: 14,
        paddingVertical: 15, alignItems: "center", marginTop: 4,
        shadowColor: "#22c55e", shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
    },
    submitBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});