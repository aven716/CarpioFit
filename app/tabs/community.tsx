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

            {/* Sticky Header */}
            <View style={styles.header}>
                <View style={styles.headerTop}>
                    <View>
                        <Text style={styles.headerTitle}>Community</Text>
                        <Text style={styles.headerSub}>Connect & share your journey</Text>
                    </View>
                    <TouchableOpacity style={styles.newPostBtn} onPress={() => setModalVisible(true)}>
                        <Plus size={16} color="#0a0a0a" />
                        <Text style={styles.newPostBtnText}>New Post</Text>
                    </TouchableOpacity>
                </View>

                {/* Search */}
                <View style={styles.searchContainer}>
                    <Search size={16} color="#888" />
                    <TextInput
                        placeholder="Search posts..."
                        placeholderTextColor="#555"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        style={styles.searchInput}
                    />
                </View>
            </View>

            {/* Category Filter */}
            <View style={styles.categoriesWrapper}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoriesRow}>
                    {CATEGORIES.map((cat) => (
                        <TouchableOpacity
                            key={cat}
                            style={[styles.catBtn, activeCategory === cat && styles.catBtnActive]}
                            onPress={() => setActiveCategory(cat)}
                        >
                            <Text style={[styles.catBtnText, activeCategory === cat && styles.catBtnTextActive]}>
                                {cat}
                            </Text>
                        </TouchableOpacity>
                    ))}
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
                    filteredPosts.map((post) => (
                        <View key={post.id} style={styles.postCard}>
                            {/* Post Header */}
                            <View style={styles.postHeader}>
                                <View style={styles.avatarCircle}>
                                    <Text style={styles.avatarText}>{post.avatar}</Text>
                                </View>
                                <View style={styles.postMeta}>
                                    <View style={styles.postMetaTop}>
                                        <Text style={styles.authorName}>{post.author}</Text>
                                        <Text style={styles.timestamp}>{post.timestamp}</Text>
                                    </View>
                                    <View style={styles.categoryBadge}>
                                        <Text style={styles.categoryBadgeText}>{post.category}</Text>
                                    </View>
                                </View>
                            </View>

                            {/* Post Content */}
                            <Text style={styles.postTitle}>{post.title}</Text>
                            <Text style={styles.postContent}>{post.content}</Text>

                            {/* Actions */}
                            <View style={styles.postActions}>
                                <TouchableOpacity style={styles.actionBtn} onPress={() => toggleLike(post.id)}>
                                    <Heart
                                        size={18}
                                        color={post.isLiked ? "#22c55e" : "#888"}
                                        fill={post.isLiked ? "#22c55e" : "transparent"}
                                    />
                                    <Text style={[styles.actionText, post.isLiked && styles.actionTextActive]}>
                                        {post.likes}
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.actionBtn}>
                                    <MessageSquare size={18} color="#888" />
                                    <Text style={styles.actionText}>{post.comments}</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    ))
                )}

                {/* Trending Topics */}
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
                            {POST_CATEGORIES.map((cat) => (
                                <TouchableOpacity
                                    key={cat}
                                    style={[styles.catPickerBtn, newPost.category === cat && styles.catPickerBtnActive]}
                                    onPress={() => setNewPost({ ...newPost, category: cat })}
                                >
                                    <Text style={[styles.catPickerText, newPost.category === cat && styles.catPickerTextActive]}>
                                        {cat}
                                    </Text>
                                </TouchableOpacity>
                            ))}
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

    // Header
    header: {
        backgroundColor: "#1a1a1a",
        padding: 16,
        paddingTop: 52,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.4,
        shadowRadius: 6,
        elevation: 6,
    },
    headerTop: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 14,
    },
    headerTitle: { color: "#fff", fontSize: 18, fontWeight: "700" },
    headerSub: { color: "#888", fontSize: 12, marginTop: 2 },
    newPostBtn: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#22c55e",
        paddingHorizontal: 14,
        paddingVertical: 9,
        borderRadius: 10,
        gap: 6,
    },
    newPostBtnText: { color: "#0a0a0a", fontSize: 13, fontWeight: "700" },
    searchContainer: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#2a2a2a",
        borderRadius: 12,
        paddingHorizontal: 12,
        gap: 8,
    },
    searchInput: { flex: 1, color: "#fff", fontSize: 14, paddingVertical: 11 },

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
    catBtnActive: { backgroundColor: "#22c55e", borderColor: "#22c55e" },
    catBtnText: { color: "#888", fontSize: 13, fontWeight: "500" },
    catBtnTextActive: { color: "#0a0a0a", fontWeight: "700" },

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
        backgroundColor: "#1a1a1a",
        borderRadius: 16,
        padding: 16,
        gap: 10,
    },
    postHeader: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
    avatarCircle: {
        width: 42, height: 42, borderRadius: 21,
        backgroundColor: "rgba(34,197,94,0.1)",
        alignItems: "center", justifyContent: "center",
        flexShrink: 0,
    },
    avatarText: { color: "#22c55e", fontSize: 13, fontWeight: "700" },
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
        borderColor: "#3a3a3a",
        borderRadius: 6,
        paddingHorizontal: 8,
        paddingVertical: 2,
    },
    categoryBadgeText: { color: "#888", fontSize: 11 },
    postTitle: { color: "#fff", fontSize: 15, fontWeight: "600" },
    postContent: { color: "#999", fontSize: 13, lineHeight: 20 },
    postActions: {
        flexDirection: "row",
        gap: 16,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: "#2a2a2a",
    },
    actionBtn: { flexDirection: "row", alignItems: "center", gap: 6 },
    actionText: { color: "#888", fontSize: 13 },
    actionTextActive: { color: "#22c55e" },

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
    catPickerBtnActive: { backgroundColor: "#22c55e", borderColor: "#22c55e" },
    catPickerText: { color: "#888", fontSize: 13 },
    catPickerTextActive: { color: "#0a0a0a", fontWeight: "700" },
    submitBtn: {
        backgroundColor: "#22c55e", borderRadius: 14,
        paddingVertical: 15, alignItems: "center", marginTop: 4,
        shadowColor: "#22c55e", shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
    },
    submitBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
