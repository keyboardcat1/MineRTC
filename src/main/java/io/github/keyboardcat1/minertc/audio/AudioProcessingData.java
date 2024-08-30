package io.github.keyboardcat1.minertc.audio;

import java.nio.ByteBuffer;
import java.util.HashMap;
import java.util.UUID;

/**
 * A class representing the required audio processing data to process each incoming player audio stream indexed by
 * player UUID
 */
public class AudioProcessingData extends HashMap<UUID, AudioProcessingData.StreamProcessingData> {

    /**
     * Converts this object into bytes
     * @return A {@link ByteBuffer} encoding this object's keys and values
     */
    public final ByteBuffer toBytes() {
        ByteBuffer out = ByteBuffer.allocate((16 + StreamProcessingData.BYTES) * this.size());
        this.forEach((uid, processingData) -> {
            out.putLong(uid.getMostSignificantBits());
            out.putLong(uid.getLeastSignificantBits());
            out.put(processingData.toBytes().position(0));
        });
        out.position(0);
        return out;
    }


    /**
     * A record representing the required data to process a single player audio channel
     * @param gain The gain factor, ranging from 0 to 1
     * @param pan The pan factor, randing from -1 to 1
     */
    public record StreamProcessingData(byte enabled, float gain, float pan) {
        /**
         * The total size in bytes of all of this object's fields
         */
        public static int BYTES = Float.BYTES + Float.BYTES + Byte.BYTES;

        /**
         * Converts this object into bytes
         * @return A {@link ByteBuffer} encoding this object's fields
         */
        public ByteBuffer toBytes() {
            ByteBuffer out = ByteBuffer.allocate(BYTES);
            out.putFloat(this.gain);
            out.putFloat(this.pan);
            out.put(this.enabled);
            return out;
        }

    }
}

