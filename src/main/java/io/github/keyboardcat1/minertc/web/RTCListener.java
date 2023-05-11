package io.github.keyboardcat1.minertc.web;

import com.google.gson.Gson;
import io.github.keyboardcat1.minertc.MineRTC;
import io.github.keyboardcat1.minertc.TokenManager;
import org.bukkit.Bukkit;
import org.eclipse.jetty.websocket.api.Session;
import org.eclipse.jetty.websocket.api.WebSocketListener;

import java.io.IOException;
import java.util.HashMap;
import java.util.Objects;
import java.util.UUID;

/**
 * A WebSocket endpoint acting as an WebRTC signaling server by relaying sent data to every connected session
 */
public class RTCListener implements WebSocketListener {
    private Session session;
    private UUID uuid;
    public static HashMap<UUID, Session> sessions = new HashMap<>();
    private final Gson gson = new Gson();
    @Override
    public void onWebSocketConnect(Session session) {
        this.session = session;

        if (session.getUpgradeRequest().getParameterMap().get("u") == null || session.getUpgradeRequest().getParameterMap().get("t") == null)
            session.close();
        uuid = UUID.fromString(session.getUpgradeRequest().getParameterMap().get("u").get(0));
        String token = session.getUpgradeRequest().getParameterMap().get("t").get(0);

        //validate token and check that player is online
        //noinspection DataFlowIssue
        if (Bukkit.getPlayer(uuid) != null && Bukkit.getPlayer(uuid).isOnline() && TokenManager.login(uuid, token)) {
            //allow a player to only be connected once
            if (sessions.get(uuid) != null) {
                sessions.get(uuid).close();
            }
            sessions.put(uuid, session);
        } else {
            session.close();
        }

    }

    @Override
    public void onWebSocketText(String message) {
        RTCPacket packet = gson.fromJson(message,RTCPacket.class);

        if (!Objects.equals(packet.from, uuid.toString())) return;

        if (sessions.get(UUID.fromString(packet.to)) == null) {
            RTCPacket errorPacket = new RTCPacket();
            errorPacket.from = "server";
            errorPacket.to = uuid.toString();
            errorPacket.type = "error";
            try {
                session.getRemote().sendString(gson.toJson(errorPacket));
            } catch (IOException e) {
                MineRTC.getInstance().getLogger().severe("WS : Could not send string");
            }
        } else {
            try {
                session.getRemote().sendString(message);
            } catch (IOException e) {
                MineRTC.getInstance().getLogger().severe("WS : Could not send string");
            }
        }
    }

    @SuppressWarnings("unused")
    static class RTCPacket {
        String from;
        String to;
        String type;
    }
}
