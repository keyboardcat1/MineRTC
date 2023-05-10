package io.github.keyboardcat1.minertc.web;

import io.github.keyboardcat1.minertc.MineRTC;
import org.eclipse.jetty.server.*;
import org.eclipse.jetty.servlet.ServletContextHandler;
import org.eclipse.jetty.servlet.ServletHolder;
import org.eclipse.jetty.util.ssl.SslContextFactory;
import org.eclipse.jetty.websocket.server.config.JettyWebSocketServletContainerInitializer;

import java.io.InputStream;
import java.security.KeyStore;



/**
 * A class encapsulating an embedded Jetty web app, and hence providing a {@code main} method to start the server
 */
public class AppServer {
    private static final String PASSWORD ="......";

    public static void main(String[] args) throws Exception {
        Server server = new Server();

        //SSL config
        //INFO: THIS SSL CONFIG SERVES NO USE IN SECURING. THE CERTIFICATE IS NOT SIGNED BY A CA.
        //IT IS ONLY TO ALLOW FOR A "SECURE" CONTEXT TO CAPTURE MEDIA VIA navigator.media
        HttpConfiguration httpConfig = new HttpConfiguration();

        //disable sni check
        SecureRequestCustomizer src = new SecureRequestCustomizer();
        src.setSniHostCheck(false);
        httpConfig.addCustomizer(src);

        HttpConnectionFactory http11 = new HttpConnectionFactory(httpConfig);

        //load keystore
        InputStream is = AppServer.class.getClassLoader().getResourceAsStream("minertc.jks");
        assert is != null;
        KeyStore ks = KeyStore.getInstance(KeyStore.getDefaultType());
        ks.load(is, PASSWORD.toCharArray());

        SslContextFactory.Server sslContextFactory = new SslContextFactory.Server();
        sslContextFactory.setKeyStore(ks);
        sslContextFactory.setKeyStorePassword(PASSWORD);

        SslConnectionFactory tls = new SslConnectionFactory(sslContextFactory, http11.getProtocol());
        ServerConnector connector = new ServerConnector(server, tls, http11);




        //http servlets
        ServletContextHandler servletContextHandler = new ServletContextHandler(server, "/");
        servletContextHandler.addServlet(new ServletHolder(new MainServlet()), "/");
        //ws listeners
        servletContextHandler.addServlet(new ServletHolder(new StaticServlet()), "/static/*");
        JettyWebSocketServletContainerInitializer.configure(servletContextHandler, (servletContext, container) -> {
            container.addMapping("/ws/mc", MCListener.class);
            container.addMapping("/ws/rtc", RTCListener.class);
        });



        connector.setPort(MineRTC.PORT);
        server.addConnector(connector);
        server.setHandler(servletContextHandler);
        server.start();
    }
}
