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
     * TODO
     */
    public record StreamProcessingData(float forwardX, float forwardY, float forwardZ,
                                       float positionX, float positionY, float positionZ,
                                       float orientationX, float orientationY, float orientationZ,
                                       byte enabled) {
        /**
         * The total size in bytes of all of this object's fields
         */
        public static final int BYTES = Byte.BYTES + 9*Float.BYTES ;

        /**
         * Converts this object into bytes
         * @return A {@link ByteBuffer} encoding this object's fields
         */
        public ByteBuffer toBytes() {
            ByteBuffer out = ByteBuffer.allocate(BYTES);
            out.putFloat(forwardX); out.putFloat(forwardY); out.putFloat(forwardZ);
            out.putFloat(positionX); out.putFloat(positionY); out.putFloat(positionZ);
            out.putFloat(orientationX); out.putFloat(orientationY); out.putFloat(orientationZ);
            out.put(enabled);
            return out;
        }

    }
}

