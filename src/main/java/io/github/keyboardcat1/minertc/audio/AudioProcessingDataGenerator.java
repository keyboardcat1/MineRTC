package io.github.keyboardcat1.minertc.audio;

import io.github.keyboardcat1.minertc.web.MCListener;
import io.github.keyboardcat1.minertc.web.RTCListener;
import org.bukkit.Bukkit;
import org.bukkit.entity.Player;

/**
 * A class to provide players with {@code AudioProcessingData} based on their relative positions
 */
public class AudioProcessingDataGenerator {
    /**
     * Generates {@code AudioProcessingData} for a given player.
     * @param player The player for which we generate {@code AudioProcessingData}
     * @return {@code AudioProcessingData} containing all the required data to process incoming audio for that player
     */
    public static AudioProcessingData playerToAudioProcessingData(Player player) {

        AudioProcessingData out = new AudioProcessingData();
        Bukkit.getOnlinePlayers().forEach((other) -> {
            int THRESHOLD = 50;
            if (player.equals(other)) return;
            if (MCListener.sessions.get(other.getUniqueId()) == null || RTCListener.sessions.get(other.getUniqueId()) == null)
                return;
            if (player.getLocation().distance(other.getLocation()) > THRESHOLD) return;

            out.put(other.getUniqueId(), playersToChannelProcessingData(player, other));
        });
        return out;
    }

    /**
     * Generates {@code ChannelProcessingData} for a given player based on another player
     * @param main The player for which we generate {@code ChannelProcessingData}
     * @param other One of the players providing the incoming audio for the main player
     * @return {@code ChannelProcessingData} encoding information about the other's players position
     * relative to the main player
     */
    protected static AudioProcessingData.ChannelProcessingData playersToChannelProcessingData(Player main, Player other) {
        double deltaX = other.getLocation().getX() - main.getLocation().getX();
        double deltaY = other.getLocation().getY() - main.getLocation().getY();
        double theta = Math.atan2(deltaY, deltaX);

        double distance = main.getLocation().distance(other.getLocation());
        double deltaTheta = theta - Math.toRadians(main.getLocation().getYaw());

        float gain = (float) (1 / (distance + 1));
        float pan = (float) Math.sin(deltaTheta);

        return new AudioProcessingData.ChannelProcessingData(gain, pan);
    }


}
