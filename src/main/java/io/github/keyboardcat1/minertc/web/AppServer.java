package io.github.keyboardcat1.minertc.web;

import io.github.keyboardcat1.minertc.MineRTC;
import org.eclipse.jetty.server.Connector;
import org.eclipse.jetty.server.Server;
import org.eclipse.jetty.server.ServerConnector;
import org.eclipse.jetty.servlet.ServletContextHandler;
import org.eclipse.jetty.servlet.ServletHolder;
import org.eclipse.jetty.websocket.server.config.JettyWebSocketServletContainerInitializer;

public class AppServer {

    public static void main(String[] args) throws Exception {

        Server server = new Server(MineRTC.PORT);

        Connector connector = new ServerConnector(server);
        server.addConnector(connector);

        ServletContextHandler servletContextHandler = new ServletContextHandler(server, "/");

        //main page servlet
        servletContextHandler.addServlet(new ServletHolder(new MainServlet()), "/main");
        JettyWebSocketServletContainerInitializer.configure(servletContextHandler, (servletContext, container) -> {
            //minecraft data websocket endpoint
            container.addMapping("/ws/mc", MCListener.class);
            //rtc signaling websocket endpoint
            container.addMapping("/ws/rtc", RTCListener.class);
        });

        server.setHandler(servletContextHandler);
        server.start();
    }
}
