import React, { useState, useEffect } from 'react';
import {
  Heart,
  Flag,
  MessageCircle,
  ThumbsUp,
  ThumbsDown,
  Send,
} from 'lucide-react';
import { clsx } from 'clsx';
import OpenAI from 'openai';
import { ANTIBULLY_ASSISTANT } from './config/llmMessages';
import profilePic from '/images/profile_1.png'

interface Comment {
  id: number;
  username: string;
  content: string;
  likes: number;
  dislikes: number;
  isAI?: boolean;
}

// Add interface for the post structure
interface Post {
  id: number;
  content: {
    text: string;
    image: string;
  };
  timestamp: string;
  author: {
    id: string;
    name: string;
    profile_picture: string;
    role: string;
  };
  likes: number;
  comments: Array<{
    id: string;
    content: {
      text: string;
    };
    timestamp: string;
    author: {
      id: string;
      name: string;
      profile_picture: string;
      role: string;
    };
    likes: number;
    dislikes: number;
  }>;
}

// Add at the top with other interfaces
interface AIResponse {
  student_role: string;
  response_in_role: string;
  how_to_respond_reflectively: string;
  how_to_respond_specifically: string;
  how_to_respond_relately: string;
  final_response: string;
}

// Add this constant for role-based profiles
const ROLE_PROFILES = {
  bystander: {
    name: 'Tom',
    profile_picture: '/images/bystander_profile.png'
  },
  educator: {
    name: 'Ms. Smith',
    profile_picture: '/images/educator_profile.jpeg'
  },
  victim: {
    name: 'Dylan',
    profile_picture: '/images/victim_profile.png'
  },
  bully: {
    name: 'Sarah',
    profile_picture: '/images/profile_1.png'
  }
};

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  baseURL: import.meta.env.VITE_BASE_URL,
  dangerouslyAllowBrowser: true, // Note: In production, you should use a backend service
});

interface ImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
}

const ImageWithFallback = ({ src, alt, ...props }: ImageProps) => {
  const [error, setError] = useState(false);
  
  return (
    <img 
      src={error ? '/default-fallback.png' : src}
      alt={alt}
      onError={() => setError(true)}
      {...props}
    />
  );
};

// Add this new component for adaptive image display
const AdaptiveImage = ({ src, alt, ...props }: ImageProps) => {
  const [error, setError] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  
  return (
    <div className="relative">
      <img 
        src={error ? '/default-fallback.png' : src}
        alt={alt}
        onClick={() => setIsExpanded(!isExpanded)}
        onError={() => setError(true)}
        className={clsx(
          'rounded-lg cursor-pointer transition-all duration-300',
          {
            'w-full max-h-64 object-contain': !isExpanded,
            'w-full max-h-[80vh] object-contain': isExpanded
          }
        )}
        {...props}
      />
      {!error && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="absolute bottom-2 right-2 bg-black/50 text-white px-2 py-1 rounded text-sm hover:bg-black/70 transition-colors"
        >
          {isExpanded ? 'Show Less' : 'Show More'}
        </button>
      )}
    </div>
  );
};

// Add this new component for the post list
const PostList = ({ posts, onSelectPost }: { posts: Post[], onSelectPost: (post: Post) => void }) => {
  return (
    <div className="max-w-2xl mx-auto space-y-4 p-4">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Recent Posts</h2>
      {posts.map((post) => (
        <div
          key={post.id}
          onClick={() => onSelectPost(post)}
          className="bg-white rounded-xl shadow-md overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
        >
          <div className="p-4">
            <div className="flex items-center space-x-3 mb-4">
              <ImageWithFallback
                src={post.author.profile_picture}
                alt={post.author.name}
                className="w-10 h-10 rounded-full object-cover"
              />
              <div>
                <h3 className="font-semibold text-gray-800">{post.author.name}</h3>
                <p className="text-sm text-gray-500">
                  {new Date(post.timestamp).toLocaleString()}
                </p>
              </div>
            </div>
            <p className="text-gray-800 mb-4">{post.content.text}</p>
            {post.content.image && (
              <div className="w-full h-48 overflow-hidden rounded-lg">
                <img
                  src={post.content.image}
                  alt="Post preview"
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <div className="mt-4 flex items-center space-x-4 text-sm text-gray-500">
              <span className="flex items-center space-x-1">
                <Heart className="w-4 h-4" />
                <span>{post.likes}</span>
              </span>
              <span className="flex items-center space-x-1">
                <MessageCircle className="w-4 h-4" />
                <span>{post.comments.length} comments</span>
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

function App() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [liked, setLiked] = useState(false);
  const [flagged, setFlagged] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [postLikes, setPostLikes] = useState(0);

  useEffect(() => {
    fetch('/example_posts.json')
      .then(response => response.json())
      .then(data => {
        setPosts(data);
      })
      .catch(error => console.error('Error loading posts:', error));
  }, []);

  const handleSelectPost = (post: Post) => {
    setSelectedPost(post);
    setLiked(false);
    setFlagged(false);
    setPostLikes(post.likes);
    setNewComment('');
  };

  const handleBackToList = () => {
    setSelectedPost(null);
    setLiked(false);
    setFlagged(false);
    setNewComment('');
  };

  const generateAIResponse = async (userComment: string) => {
    try {
      if (!import.meta.env.VITE_OPENAI_API_KEY || !import.meta.env.VITE_BASE_URL) {
        // Fallback responses if API key is not available
        return {
          student_role: "Constructive upstander",
          response_in_role: "educator",
          how_to_respond_reflectively: "Show empathy",
          how_to_respond_specifically: "Address bullying directly",
          how_to_respond_relately: "Build positive relationships",
          final_response: "That's an interesting perspective! I appreciate you sharing your thoughts."
        } as AIResponse;
      }

      // Create context from the post and its comments
      const contextMessage = {
        role: 'user',
        content: `Context:
Original post: "${selectedPost?.content.text}"
Previous comments:
${selectedPost?.comments.map(comment => `${comment.author.name}: ${comment.content.text}`).join('\n')}

New comment from user: "${userComment}"

Please respond to this comment considering the context above.`
      };

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-2024-11-20',
        messages: [
          ANTIBULLY_ASSISTANT,
          contextMessage
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
      });

      const responseContent = completion.choices[0]?.message?.content;

      if (!responseContent) {
        throw new Error('Empty response from AI');
      }

      try {
        const parsedResponse = JSON.parse(responseContent) as AIResponse;
        
        // Validate the response has all required fields
        if (!parsedResponse.student_role || 
            !parsedResponse.response_in_role || 
            !parsedResponse.final_response) {
          throw new Error('Invalid response format');
        }

        return {
          student_role: parsedResponse.student_role,
          response_in_role: parsedResponse.response_in_role,
          how_to_respond_reflectively: parsedResponse.how_to_respond_reflectively || '',
          how_to_respond_specifically: parsedResponse.how_to_respond_specifically || '',
          how_to_respond_relately: parsedResponse.how_to_respond_relately || '',
          final_response: parsedResponse.final_response
        } as AIResponse;

      } catch (parseError) {
        console.error('Error parsing AI response:', parseError);
        throw new Error('Failed to parse AI response');
      }
    } catch (error) {
      console.error('Error in generateAIResponse:', error);
      return {
        student_role: "Constructive upstander",
        response_in_role: "educator",
        how_to_respond_reflectively: "Show empathy",
        how_to_respond_specifically: "Address bullying directly",
        how_to_respond_relately: "Build positive relationships",
        final_response: "I apologize, but I'm having trouble processing your comment at the moment."
      } as AIResponse;
    }
  };

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    setIsLoading(true);

    // Add user comment first
    const userCommentData = {
      id: `comment_${Date.now()}`,
      content: { text: newComment },
      timestamp: new Date().toISOString(),
      author: {
        id: 'user_temp',
        name: 'User',
        profile_picture: '/images/default_user_profile.png',
        role: 'user'
      },
      likes: 0,
      dislikes: 0
    };

    setSelectedPost(prevPost => {
      if (!prevPost) return prevPost;
      return {
        ...prevPost,
        comments: [...prevPost.comments, userCommentData]
      };
    });

    setNewComment('');

    // Generate and add AI response
    try {
      const aiResponse = await generateAIResponse(newComment);
      
      // Get the profile info based on the AI's chosen role
      const roleProfile = ROLE_PROFILES[aiResponse.response_in_role.toLowerCase()] || ROLE_PROFILES.educator;
      
      const aiCommentData = {
        id: `ai_${Date.now()}`,
        content: { text: aiResponse.final_response },
        timestamp: new Date().toISOString(),
        author: {
          id: `assistant_${Date.now()}`,
          name: roleProfile.name,
          profile_picture: roleProfile.profile_picture,
          role: 'assistant'
        },
        likes: 0,
        dislikes: 0
      };

      setSelectedPost(prevPost => {
        if (!prevPost) return prevPost;
        return {
          ...prevPost,
          comments: [...prevPost.comments, aiCommentData]
        };
      });
    } catch (error) {
      console.error('Error in comment submission:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Add these new functions to handle likes/dislikes
  const handlePostLike = () => {
    setLiked(!liked);
    setPostLikes(prev => liked ? prev - 1 : prev + 1);
    setSelectedPost(prevPost => {
      if (!prevPost) return prevPost;
      return {
        ...prevPost,
        likes: liked ? prevPost.likes - 1 : prevPost.likes + 1
      };
    });
  };

  const handleCommentLike = (commentId: string, isLike: boolean) => {
    setSelectedPost(prevPost => {
      if (!prevPost) return prevPost;
      return {
        ...prevPost,
        comments: prevPost.comments.map(comment => {
          if (comment.id === commentId) {
            return {
              ...comment,
              likes: isLike ? comment.likes + 1 : comment.likes,
              dislikes: !isLike ? comment.dislikes + 1 : comment.dislikes
            };
          }
          return comment;
        })
      };
    });
  };

  if (!selectedPost) return <PostList posts={posts} onSelectPost={handleSelectPost} />;

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-2xl mx-auto">
        <button
          onClick={handleBackToList}
          className="mb-4 px-4 py-2 text-blue-500 hover:text-blue-600 transition-colors flex items-center space-x-2"
        >
          <span>← Back to Posts</span>
        </button>
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          {/* Post Header */}
          <div className="p-4 border-b flex items-center space-x-3">
            <ImageWithFallback
              src={selectedPost.author.profile_picture}
              alt={selectedPost.author.name}
              className="w-10 h-10 rounded-full object-cover"
            />
            <div>
              <h3 className="font-semibold text-gray-800">{selectedPost.author.name}</h3>
              <p className="text-sm text-gray-500">
                {new Date(selectedPost.timestamp).toLocaleString()}
              </p>
            </div>
          </div>

          {/* Post Content */}
          <div className="p-4">
            {selectedPost.content.image && (
              <div className="mb-4">
                <AdaptiveImage
                  src={selectedPost.content.image}
                  alt="Post image"
                />
              </div>
            )}
            <p className="text-gray-800">{selectedPost.content.text}</p>
          </div>

          {/* Interaction Buttons */}
          <div className="px-4 py-2 border-t border-b flex space-x-6">
            <button
              onClick={handlePostLike}
              className={clsx(
                'flex items-center space-x-2 text-gray-500 hover:text-red-500 transition-colors',
                { 'text-red-500': liked }
              )}
            >
              <Heart className="w-5 h-5" />
              <span>Like ({postLikes})</span>
            </button>
            <button className="flex items-center space-x-2 text-gray-500 hover:text-blue-500 transition-colors">
              <MessageCircle className="w-5 h-5" />
              <span>Reply ({selectedPost.comments.length})</span>
            </button>
            <button
              onClick={() => setFlagged(!flagged)}
              className={clsx(
                'flex items-center space-x-2 text-gray-500 hover:text-yellow-500 transition-colors',
                { 'text-yellow-500': flagged }
              )}
            >
              <Flag className="w-5 h-5" />
              <span>Flag</span>
            </button>
          </div>

          {/* Comments Section */}
          <div className="p-4 space-y-4">
            {selectedPost.comments.map((comment) => (
              <div
                key={comment.id}
                className={clsx('p-3 rounded-lg', {
                  'bg-blue-50': comment.author.role === 'assistant',
                  'bg-gray-50': comment.author.role === 'user'
                })}
              >
                <div className="flex items-center space-x-2 mb-2">
                  <ImageWithFallback
                    src={comment.author.profile_picture}
                    alt={comment.author.name}
                    className="w-8 h-8 rounded-full object-cover"
                  />
                  <span className="font-semibold">{comment.author.name}</span>
                  {comment.author.role === 'assistant' && (
                    <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                      AI
                    </span>
                  )}
                </div>
                <p className="text-gray-800 mb-2">{comment.content.text}</p>
                <div className="flex items-center space-x-4 text-sm text-gray-500">
                  <button 
                    onClick={() => handleCommentLike(comment.id, true)}
                    className="flex items-center space-x-1 hover:text-blue-500 transition-colors"
                  >
                    <ThumbsUp className="w-4 h-4" />
                    <span>{comment.likes}</span>
                  </button>
                  <button 
                    onClick={() => handleCommentLike(comment.id, false)}
                    className="flex items-center space-x-1 hover:text-red-500 transition-colors"
                  >
                    <ThumbsDown className="w-4 h-4" />
                    <span>{comment.dislikes}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Comment Input */}
          <form onSubmit={handleSubmitComment} className="p-4 border-t">
            <div className="flex space-x-2">
              <input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder={isLoading ? "AI is typing..." : "Write a comment..."}
                className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isLoading}
              />
              <button
                type="submit"
                className={clsx(
                  'px-4 py-2 bg-blue-500 text-white rounded-lg transition-colors flex items-center space-x-2',
                  {
                    'hover:bg-blue-600': !isLoading,
                    'opacity-50 cursor-not-allowed': isLoading,
                  }
                )}
                disabled={isLoading}
              >
                <Send className="w-4 h-4" />
                <span>{isLoading ? 'Sending...' : 'Send'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default App;
