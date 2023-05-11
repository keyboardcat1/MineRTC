package io.github.keyboardcat1.minertc.web;

import io.github.keyboardcat1.minertc.TokenManager;
import org.bukkit.Bukkit;
import org.eclipse.jetty.websocket.api.Session;
import org.eclipse.jetty.websocket.api.WebSocketListener;

import java.util.HashMap;
import java.util.UUID;

/**
 * A WebSocket endpoint meant to provide {@code AudioProcessingData}
 * @see io.github.keyboardcat1.minertc.MineRTC
 */
@SuppressWarnings("FieldCanBeLocal")
public class MCListener implements WebSocketListener {
    @SuppressWarnings("unused")
    private Session session;
    private UUID uuid;
    public static HashMap<UUID, Session> sessions = new HashMap<>();
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
}
