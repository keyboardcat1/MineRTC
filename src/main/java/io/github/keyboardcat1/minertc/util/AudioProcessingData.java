package io.github.keyboardcat1.minertc.util;

import java.nio.ByteBuffer;
import java.util.HashMap;
import java.util.UUID;

public class AudioProcessingData extends HashMap<UUID, AudioProcessingData.ChannelProcessingData> {

    public final ByteBuffer toBytes() {
        ByteBuffer out = ByteBuffer.allocate((16 + AudioProcessingData.ChannelProcessingData.BYTES) * this.size());
        this.forEach((uid, processingData) -> {
            out.putLong(uid.getMostSignificantBits());
            out.putLong(uid.getLeastSignificantBits());
            out.put(processingData.toBytes().position(0));
        });
        out.position(0);
        return out;
    }

    public static class ChannelProcessingData {
        public static int BYTES = Float.BYTES + Float.BYTES;
        public final float gain;
        private final float pan;

        public ChannelProcessingData(float gain, float pan) {
            this.gain = gain;
            this.pan = pan;
        }

        public ByteBuffer toBytes() {
            ByteBuffer out = ByteBuffer.allocate(BYTES);
            out.putFloat(this.gain);
            out.putFloat(this.pan);
            return out;
        }
    }
}

