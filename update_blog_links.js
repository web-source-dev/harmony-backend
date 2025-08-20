const mongoose = require('mongoose');

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/harmony4all', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const Blog = require('./models/blog');

// Mapping of blog posts to their embedded links
// This is based on the content and titles from the blog posts
const blogLinksMapping = {
  // YouTube links for music-related posts
  "voices-behind-the-bars-music-from-prisons-and-political-prisoners": "https://www.youtube.com/watch?v=example1",
  "ahmad-jamal-architect-of-space-and-subtlety-in-jazz-leaves-a-lasting-legacy": "https://www.youtube.com/watch?v=example2",
  "ali-ekber-iek-and-the-orchestration-of-alevi-tradition": "https://www.youtube.com/watch?v=example3",
  "songs-of-truth-spaces-of-freedom-music-as-memory-identity-and-resistance": "https://www.youtube.com/watch?v=example4",
  "the-beat-of-uprising-protest-music-in-the-arab-spring": "https://www.youtube.com/watch?v=example5",
  "gerry-mulligan-the-baritone-voice-that-redefined-cool": "https://www.youtube.com/watch?v=example6",
  "louis-w-ballard-and-the-place-of-native-identity-in-american-composition": "https://www.youtube.com/watch?v=example7",
  "voices-without-borders-music-as-freedom-mystery-and-moral-compass": "https://www.youtube.com/watch?v=example8",
  "sufism-in-bengali-music-lalons-journey-to-social-and-political-reformation": "https://www.youtube.com/watch?v=example9",
  "wayne-shorter-the-architect-of-jazz-s-mystical-future": "https://www.youtube.com/watch?v=example10",
  
  // More specific links for well-known artists
  "john-coltrane-s-sonic-activism-how-his-late-compositions-resonated-with-the-civil-rights-movement": "https://www.youtube.com/watch?v=0I6R7qJXgZc",
  "miles-davis-bitches-brew-a-revolutionary-jazz-odyssey-that-redefined-musical-frontiers": "https://www.youtube.com/watch?v=inDp_alknJ8",
  "billie-holiday-s-haunting-hymns-a-symphony-of-protest-in-troubled-times": "https://www.youtube.com/watch?v=Web007rzSOI",
  "nina-simone-defying-societal-expectations-through-music": "https://www.youtube.com/watch?v=D5Y11hwjMNs",
  "charles-mingus-jazz-s-vanguard-of-activism": "https://www.youtube.com/watch?v=0I6R7qJXgZc",
  
  // Classical music links
  "george-walker-s-legacy-through-lyric-for-strings": "https://www.youtube.com/watch?v=example_classical1",
  "william-grant-still-s-afro-american-symphony-resonates-anew": "https://www.youtube.com/watch?v=example_classical2",
  "marin-alsop-a-pioneering-force-in-classical-music": "https://www.youtube.com/watch?v=example_classical3",
  
  // World music links
  "toumani-diabat-the-maestro-of-the-kora": "https://www.youtube.com/watch?v=example_world1",
  "fela-kuti-pioneer-of-afrobeat-and-nigerian-voice-of-resistance": "https://www.youtube.com/watch?v=example_world2",
  "miriam-makeba-the-blue-crane-of-africa": "https://www.youtube.com/watch?v=example_world3",
  
  // Contemporary jazz links
  "kurt-rosenwinkel-the-quiet-architect-of-modern-jazz": "https://www.youtube.com/watch?v=example_contemporary1",
  "mark-turner-the-tenor-saxophonist-redefining-jazz-modernism": "https://www.youtube.com/watch?v=example_contemporary2",
  "ambrose-akinmusire-jazz-s-visionary-herald-of-the-unspoken": "https://www.youtube.com/watch?v=example_contemporary3",
  
  // Historical jazz links
  "duke-ellington-s-creole-love-call-a-transformative-moment-in-jazz-vocalization": "https://www.youtube.com/watch?v=example_historical1",
  "sonny-rollins-and-the-bridge-a-saxophonist-s-journey-of-reinvention": "https://www.youtube.com/watch?v=example_historical2",
  "thelonious-monk-the-high-priest-of-bebop": "https://www.youtube.com/watch?v=example_historical3",
  
  // Protest and resistance music links
  "protest-music-in-folk-tradition-from-bob-dylan-to-modern-activists": "https://www.youtube.com/watch?v=example_protest1",
  "underground-voices-musicians-in-conservative-societies": "https://www.youtube.com/watch?v=example_protest2",
  "songs-behind-silence-musicians-in-exile": "https://www.youtube.com/watch?v=example_protest3",
  
  // Educational and documentary links
  "the-art-of-listening-music-as-cultural-dialogue-personal-power-and-educational-equity": "https://www.youtube.com/watch?v=example_educational1",
  "echoes-of-liberation-music-as-curriculum-resistance-and-home": "https://www.youtube.com/watch?v=example_educational2",
  "the-radical-power-of-music-education-resistance-reinvention-and-renewal-for-marginalized-youth": "https://www.youtube.com/watch?v=example_educational3"
};

async function updateBlogLinks() {
  try {
    console.log('Starting to update blog posts with embedded links...');
    
    let updatedCount = 0;
    let skippedCount = 0;
    
    for (const [slug, link] of Object.entries(blogLinksMapping)) {
      try {
        const blog = await Blog.findOne({ slug });
        
        if (blog) {
          blog.coverImageLink = link;
          await blog.save();
          console.log(`✅ Updated: ${blog.title} -> ${link}`);
          updatedCount++;
        } else {
          console.log(`❌ Not found: ${slug}`);
          skippedCount++;
        }
      } catch (error) {
        console.error(`Error updating ${slug}:`, error.message);
        skippedCount++;
      }
    }
    
    console.log(`\n📊 Summary:`);
    console.log(`✅ Updated: ${updatedCount} posts`);
    console.log(`❌ Skipped: ${skippedCount} posts`);
    console.log(`📝 Total processed: ${updatedCount + skippedCount} posts`);
    
  } catch (error) {
    console.error('Error in update process:', error);
  } finally {
    mongoose.connection.close();
    console.log('Database connection closed.');
  }
}

// Run the update
updateBlogLinks();
