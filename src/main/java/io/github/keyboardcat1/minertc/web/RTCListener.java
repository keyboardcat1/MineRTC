package io.github.keyboardcat1.minertc.web;

import io.github.keyboardcat1.minertc.MineRTC;
import io.github.keyboardcat1.minertc.TokenManager;
import org.bukkit.Bukkit;
import org.eclipse.jetty.websocket.api.Session;
import org.eclipse.jetty.websocket.api.WebSocketListener;
import org.json.simple.JSONObject;
import org.json.simple.parser.JSONParser;
import org.json.simple.parser.ParseException;

import java.io.IOException;
import java.time.Duration;
import java.util.HashMap;
import java.util.UUID;

/**
 * A WebSocket endpoint acting as an WebRTC signaling server by relaying sent data to every connected session
 */
public class RTCListener implements WebSocketListener {
    private Session session;
    private UUID uuid;
    public static final HashMap<UUID, Session> sessions = new HashMap<>();
    @Override
    public void onWebSocketConnect(Session session) {
        this.session = session;

        if (session.getUpgradeRequest().getParameterMap().get("u") == null || session.getUpgradeRequest().getParameterMap().get("t") == null)
            session.close();
        uuid = UUID.fromString(session.getUpgradeRequest().getParameterMap().get("u").get(0));
        String token = session.getUpgradeRequest().getParameterMap().get("t").get(0);

        //validate token and check that player is online
        if (Bukkit.getPlayer(uuid) != null && TokenManager.login(uuid, token)) {
            //allow a player to only be connected once
            if (sessions.get(uuid) != null) {
                sessions.get(uuid).close();
            }
            sessions.put(uuid, session);
            session.setIdleTimeout(Duration.ZERO);
        } else {
            session.close();
        }

    }

    @Override
    public void onWebSocketClose(int statusCode, String reason) {
        sessions.remove(uuid);
    }

    @Override
    public void onWebSocketText(String message) {
        try {
            Object obj = new JSONParser().parse(message);
            JSONObject incoming = (JSONObject) obj;
            JSONObject outgoing = new JSONObject();

            String to = (String) incoming.get("to");
            JSONObject data = (JSONObject) incoming.get("data");

            if (sessions.get(UUID.fromString(to)) == null) return;

            outgoing.put("from", uuid.toString());
            outgoing.put("data", data);

            sessions.get(UUID.fromString(to)).getRemote().sendString(outgoing.toString());


        } catch (ParseException ignored) {
        } catch (IOException e) {
            MineRTC.getInstance().getLogger().severe("WS : Could not send string");
        }
    }
}
