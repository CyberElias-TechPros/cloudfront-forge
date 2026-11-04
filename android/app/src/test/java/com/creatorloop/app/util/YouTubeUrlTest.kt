package com.creatorloop.app.util

import org.junit.Assert.*
import org.junit.Test

class YouTubeUrlTest {
    @Test fun `extracts common YouTube URL forms`() {
        assertEquals("dQw4w9WgXcQ", YouTubeUrl.videoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ"))
        assertEquals("dQw4w9WgXcQ", YouTubeUrl.videoId("https://youtu.be/dQw4w9WgXcQ?t=10"))
        assertEquals("dQw4w9WgXcQ", YouTubeUrl.videoId("https://www.youtube.com/shorts/dQw4w9WgXcQ"))
        assertEquals("dQw4w9WgXcQ", YouTubeUrl.videoId("youtube.com/live/dQw4w9WgXcQ"))
    }
    @Test fun `rejects non YouTube links`() {
        assertNull(YouTubeUrl.videoId("https://example.com/watch?v=dQw4w9WgXcQ"))
        assertFalse(YouTubeUrl.isValid("not a url"))
    }
}
