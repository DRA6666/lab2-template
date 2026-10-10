package ru.rsoi.gateway.controller;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestClient;

import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/system")
public class SystemHealthController {
    private final RestClient client;

    @Value("${rating-url}")
    private String ratingUrl;
    @Value("${library-url}")
    private String libraryUrl;
    @Value("${reservation-url}")
    private String reservationUrl;

    public SystemHealthController(RestClient client) {
        this.client = client;
    }

    @GetMapping("/health")
    public Map<String, String> health() {
        Map<String, String> services = new LinkedHashMap<>();
        services.put("gateway", "UP");
        services.put("rating", check(ratingUrl));
        services.put("library", check(libraryUrl));
        services.put("reservation", check(reservationUrl));
        return services;
    }

    private String check(String serviceUrl) {
        try {
            client.get().uri(serviceUrl + "/manage/health").retrieve().toBodilessEntity();
            return "UP";
        } catch (RuntimeException exception) {
            return "DOWN";
        }
    }
}
