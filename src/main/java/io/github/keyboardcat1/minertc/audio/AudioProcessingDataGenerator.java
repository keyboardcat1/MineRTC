package io.github.keyboardcat1.minertc.audio;

import io.github.keyboardcat1.minertc.MineRTC;
import io.github.keyboardcat1.minertc.web.MCListener;
import io.github.keyboardcat1.minertc.web.RTCListener;
import org.bukkit.Bukkit;
import org.bukkit.Location;
import org.bukkit.entity.Player;
import org.bukkit.util.Vector;

/**
 * A class to provide players with {@link AudioProcessingData} based on their relative positions
 */
public class AudioProcessingDataGenerator {
    public static final int MAX_VOICE_DISTANCE = MineRTC.getInstance().getConfig().getInt("max-voice-distance");

    /**
     * Generates {@link AudioProcessingData} for a given player.
     * @param player The player for which we wish to generate processing data
     * @return Processing data containing all the required data to process incoming audio for that player
     */
    public static AudioProcessingData playerToAudioProcessingData(Player player) {

        AudioProcessingData out = new AudioProcessingData();
        Bukkit.getOnlinePlayers().forEach((other) -> {
            if (player.equals(other)) return;
            if (MCListener.sessions.get(other.getUniqueId()) == null || RTCListener.sessions.get(other.getUniqueId()) == null)
                return;

            out.put(other.getUniqueId(), playersToStreamProcessingData(player, other));
        });
        return out;
    }

    /**
     * Generates {@link AudioProcessingData.StreamProcessingData} for a given player based on another player
     * @param main The player for which wish to generate processing data
     * @param other One of the players providing the incoming audio for the main player
     * @return Processing data encoding the other's players position relative to the main player
     */
    protected static AudioProcessingData.StreamProcessingData playersToStreamProcessingData(Player main, Player other) {
        Vector forward =  main.getEyeLocation().getDirection();
        Location position = other.getEyeLocation().subtract(main.getEyeLocation());
        Vector orientation = other.getEyeLocation().getDirection();
        byte enabled = (byte)(position.length()<MAX_VOICE_DISTANCE-1 ? 1 : 0);

        return new AudioProcessingData.StreamProcessingData(
                (float)forward.getX(),(float)forward.getY(),(float)forward.getZ(),
                (float)position.getX(),(float)position.getY(),(float)position.getZ(),
                (float)orientation.getX(),(float)orientation.getX(),(float)orientation.getX(),
                enabled
        );
    }


}
