package io.github.keyboardcat1.minertc.command;

import io.github.keyboardcat1.minertc.MineRTC;
import io.github.keyboardcat1.minertc.TokenManager;
import io.github.keyboardcat1.minertc.web.MCListener;
import io.github.keyboardcat1.minertc.web.RTCListener;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.minimessage.MiniMessage;
import net.kyori.adventure.text.minimessage.tag.resolver.Placeholder;
import org.bukkit.command.Command;
import org.bukkit.command.CommandExecutor;
import org.bukkit.command.CommandSender;
import org.bukkit.entity.Player;
import org.jetbrains.annotations.NotNull;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.UUID;

/**
 * A command to provide the player with a connection link and to register the player with a randomized token
 */
public class ConnectCommand implements CommandExecutor {
    private static final SecureRandom secureRandom = new SecureRandom();
    private static final Base64.Encoder base64Encoder = Base64.getUrlEncoder();
    private static final String button = " <click:open_url:'<connect-link>'><hover:show_text:'Connect'><blue>[Connect]</blue></hover></click>";

    public boolean onCommand(@NotNull CommandSender sender, @NotNull Command cmd, @NotNull String label, String[] args) {
        if (sender instanceof Player player) {

            UUID uuid = player.getUniqueId();

            byte[] randomBytes = new byte[16];
            secureRandom.nextBytes(randomBytes);
            String token = base64Encoder.encodeToString(randomBytes);
            String encodedToken = URLEncoder.encode(token, StandardCharsets.UTF_8);

            MiniMessage mn = MiniMessage.miniMessage();
            String url = MineRTC.getInstance().getURL() + "/?u=" + uuid + "&t=" + encodedToken;
            Component parsed = mn.deserialize(MineRTC.getInstance().getConnectMessage() + button, Placeholder.parsed("connect-link", url));

            player.sendMessage(parsed);
            TokenManager.register(uuid, token);

            if (MCListener.sessions.get(uuid) != null) {
                MCListener.sessions.get(uuid).close(1008, "Re-issued \"/connect\".");
                MCListener.sessions.remove(uuid);
            }
            if (RTCListener.sessions.get(uuid) != null) {
                RTCListener.sessions.get(uuid).close(1008, "Re-issued \"/connect\".");
                RTCListener.sessions.remove(uuid);
            }
        }

        return true;
    }
}
